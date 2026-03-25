import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  downloadMetaMedia,
  getMetaConfig,
  getMetaConfigFromSettings,
  markMessageAsRead,
  sendMetaWhatsAppTextMessage,
  type MetaConfig,
  sendTypingIndicator,
  validateMetaWebhookSignature,
  validateMetaWebhookVerifyToken,
} from "@/lib/meta";
import { createServerClient } from "@/lib/supabase/server";
import { findMatchingFlow, executeFlow, resumeFlow } from "@/lib/flow-engine";
import { generateCoachResponse, validateProfileUpdates } from "@/lib/ai-coach";
import { classifyFlowIntent } from "@/lib/intent-classifier";
import {
  getOrganizationSettingsById,
  getOrganizationSettingsByPhoneNumberId,
  listOrganizationSettingsWithMeta,
  type OrganizationSettings,
} from "@/lib/organization";
import {
  buildStravaConnectMessage,
  buildStravaConnectUrl,
  buildStravaSyncMessage,
  detectStravaIntent,
  getStravaConnectionSummary,
  resolveAppOrigin,
  syncStravaActivitiesForConversation,
} from "@/lib/strava";

async function simulateTyping(
  messageId: string | undefined,
  text: string,
  metaConfig: MetaConfig
) {
  if (!messageId) return;
  const chars = text.length;
  const seconds = Math.min(8, Math.max(1, Math.ceil(chars / 30)));
  await sendTypingIndicator(messageId, metaConfig).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

type MetaWebhookChangeValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    profile?: { name?: string };
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
    from?: string;
    type?: string;
    text?: { body?: string };
    interactive?: {
      type?: string;
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string; description?: string };
      nfm_reply?: { response_json?: string; body?: string; name?: string };
    };
    audio?: { id?: string; mime_type?: string };
    image?: { id?: string; mime_type?: string; caption?: string };
    document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    recipient_id?: string;
    timestamp?: string;
    errors?: Array<{ code?: number; title?: string; details?: string }>;
  }>;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: MetaWebhookChangeValue;
    }>;
  }>;
};

type ResolvedMetaWebhookConfig = {
  organizationId: string | null;
  settings: OrganizationSettings | null;
  config: MetaConfig;
};

async function listWebhookConfigs(): Promise<ResolvedMetaWebhookConfig[]> {
  const configured: ResolvedMetaWebhookConfig[] = [];

  for (const settings of await listOrganizationSettingsWithMeta()) {
    const result = getMetaConfigFromSettings(settings);
    if (result.configured) {
      configured.push({
        organizationId: settings.organization_id,
        settings,
        config: result.config,
      });
    }
  }

  const envConfig = getMetaConfig();
  if (envConfig.configured) {
    configured.push({
      organizationId: null,
      settings: null,
      config: envConfig.config,
    });
  }

  return configured;
}

async function resolveFallbackOrganizationId(supabase: ReturnType<typeof createServerClient>) {
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .limit(2);

  if (error || !organizations || organizations.length !== 1) {
    return null;
  }

  return organizations[0].id as string;
}

async function resolveIncomingOrganization(params: {
  supabase: ReturnType<typeof createServerClient>;
  phoneNumberId: string | null;
  contactPhone: string;
}) {
  if (params.phoneNumberId) {
    const settings = await getOrganizationSettingsByPhoneNumberId(
      params.phoneNumberId
    );
    if (settings) {
      return {
        organizationId: settings.organization_id,
        settings,
        metaConfig: getMetaConfigFromSettings(settings).config,
      };
    }
  }

  const { data: existingConversation } = await params.supabase
    .from("conversations")
    .select("organization_id")
    .eq("contact_phone", params.contactPhone)
    .limit(1)
    .maybeSingle();

  if (existingConversation?.organization_id) {
    const settings = await getOrganizationSettingsById(
      existingConversation.organization_id as string
    );
    return {
      organizationId: existingConversation.organization_id as string,
      settings,
      metaConfig: getMetaConfigFromSettings(settings).config,
    };
  }

  const fallbackOrganizationId = await resolveFallbackOrganizationId(
    params.supabase
  );
  if (!fallbackOrganizationId) {
    return null;
  }

  const settings = await getOrganizationSettingsById(fallbackOrganizationId);
  const { configured, config } = getMetaConfigFromSettings(settings);
  if (!configured) {
    return null;
  }

  return {
    organizationId: fallbackOrganizationId,
    settings,
    metaConfig: config,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const configs = await listWebhookConfigs();
  if (configs.length === 0) {
    return NextResponse.json(
      {
        error: "Meta Cloud API credentials not configured",
      },
      { status: 400 }
    );
  }

  if (
    mode === "subscribe" &&
    configs.some((entry) =>
      validateMetaWebhookVerifyToken(verifyToken, entry.config)
    )
  ) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid webhook verification" }, { status: 403 });
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  const webhookConfigs = await listWebhookConfigs();
  if (webhookConfigs.length === 0) {
    return NextResponse.json(
      {
        error: "Meta Cloud API credentials not configured",
      },
      { status: 400 }
    );
  }

  const matchedConfig = webhookConfigs.find((entry) =>
    validateMetaWebhookSignature(signature, rawBody, entry.config)
  );

  if (!matchedConfig) {
    return NextResponse.json({ error: "Invalid Meta signature" }, { status: 403 });
  }

  const payload = JSON.parse(rawBody) as MetaWebhookPayload;

  const supabase = createServerClient();
  const appOrigin = resolveAppOrigin(request.url);

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      for (const message of value.messages || []) {
        const contactPhone = message.from || "";
        const contactName =
          value.contacts?.[0]?.profile?.name || contactPhone;
        const phoneNumberId = value.metadata?.phone_number_id || null;

        const resolvedOrganization = await resolveIncomingOrganization({
          supabase,
          phoneNumberId,
          contactPhone,
        });

        if (!resolvedOrganization) {
          console.warn("No organization resolved for inbound WhatsApp message", {
            contactPhone,
            phoneNumberId,
          });
          continue;
        }

        const organizationId = resolvedOrganization.organizationId;
        const metaConfig = resolvedOrganization.metaConfig;

        if (message.id) {
          const { data: duplicate } = await supabase
            .from("messages")
            .select("id")
            .eq("wa_message_id", message.id)
            .maybeSingle();

          if (duplicate) {
            console.log("Skipping duplicate webhook message:", message.id);
            continue;
          }
        }

        let conversationId: string;
        let isNewContact = false;
        const { data: existing } = await supabase
          .from("conversations")
          .select("id, organization_id, status, ai_enabled, active_flow_id, current_node_id, subscription_status, subscription_expires_at")
          .eq("organization_id", organizationId)
          .eq("contact_phone", contactPhone)
          .maybeSingle();

        const conversationStatus = existing?.status || "running";

        if (existing) {
          conversationId = existing.id as string;
        } else {
          isNewContact = true;
          const { data: created } = await supabase
            .from("conversations")
            .insert({
              organization_id: organizationId,
              contact_name: contactName,
              contact_phone: contactPhone,
              phone_number_id: phoneNumberId,
              status: "running",
              subscription_status: "trial",
              subscription_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            })
            .select("id")
            .single();
          conversationId = created!.id as string;
        }

        let content = "";
        let type: string = message.type || "text";
        if (type === "text") {
          content = message.text?.body || "";
        } else if (type === "interactive") {
          const btnReply = message.interactive?.button_reply;
          const listReply = message.interactive?.list_reply;
          const nfmReply = message.interactive?.nfm_reply;

          if (nfmReply?.response_json) {
            // WhatsApp Flow form submission — extract form data
            try {
              const flowResponse = JSON.parse(nfmReply.response_json);
              content = Object.entries(flowResponse)
                .filter(([k]) => k !== "flow_token")
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
              // Store raw response in metadata for the resume handler
              (message as Record<string, unknown>).__flowResponseData = flowResponse;
            } catch {
              content = nfmReply.body || "[Formulario WhatsApp]";
            }
          } else {
            content = btnReply?.title || listReply?.title || "";
          }
          type = "text";
        } else if (type === "audio" && message.audio?.id) {
          try {
            const audioBuffer = await downloadMetaMedia(message.audio.id, metaConfig);
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const uint8 = new Uint8Array(audioBuffer);
            const audioFile = new File(
              [uint8],
              "audio.ogg",
              { type: message.audio.mime_type || "audio/ogg" }
            );
            const transcription = await openai.audio.transcriptions.create({
              model: "whisper-1",
              file: audioFile,
              language: "pt",
            });
            content = transcription.text;
            type = "text";
            console.log("Audio transcribed:", content);
          } catch (error) {
            console.error("Failed to transcribe audio:", error);
            content = "[Audio nao transcrito]";
            type = "text";
          }
        }

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          content,
          type,
          sender: "contact",
          wa_message_id: message.id || null,
          metadata: {
            phone_number_id: phoneNumberId,
            original_type: message.type,
            interactive: message.interactive,
          },
        });

        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        if (message.id) {
          markMessageAsRead(message.id, metaConfig).catch(() => {});
        }

        if (conversationStatus === "human") {
          continue;
        }

        try {
          console.log("[webhook] orchestration start", {
            conversationId,
            conversationStatus,
            activeFlowId: existing?.active_flow_id,
            currentNodeId: existing?.current_node_id,
            isNewContact,
            content: content.substring(0, 50),
          });

          const stravaIntent =
            type === "text" && content ? detectStravaIntent(content) : null;

          if (stravaIntent) {
            const summary = await getStravaConnectionSummary(
              supabase,
              conversationId
            );

            let stravaReply = "";

            if (!summary.connected) {
              const connectUrl = buildStravaConnectUrl({
                conversationId,
                origin: appOrigin,
              });

              stravaReply =
                stravaIntent === "sync"
                  ? `Ainda nao encontrei um Strava conectado.\n\n${buildStravaConnectMessage(
                      connectUrl
                    )}`
                  : buildStravaConnectMessage(connectUrl);
            } else {
              await syncStravaActivitiesForConversation(supabase, conversationId, {
                force: true,
              });
              const refreshedSummary = await getStravaConnectionSummary(
                supabase,
                conversationId
              );
              const syncMessage = buildStravaSyncMessage(refreshedSummary);

              stravaReply =
                stravaIntent === "connect"
                  ? `Seu Strava ja esta conectado.\n\n${syncMessage}`
                  : syncMessage;
            }

            await simulateTyping(message.id, stravaReply, metaConfig);
            const stravaResult = await sendMetaWhatsAppTextMessage(
              {
                to: contactPhone,
                body: stravaReply,
              },
              metaConfig
            );
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              content: stravaReply,
              type: "text",
              sender: "bot",
              wa_message_id: stravaResult.messageId,
            });
            continue;
          }

          if (
            conversationStatus === "paused" &&
            existing?.active_flow_id &&
            existing?.current_node_id
          ) {
            // If the flow was deactivated while the conversation was paused,
            // clear the flow state so execution falls through to triggers / AI.
            const { data: activeFlowCheck } = await supabase
              .from("flows")
              .select("is_active")
              .eq("id", existing.active_flow_id)
              .single();

            if (!activeFlowCheck?.is_active) {
              await supabase
                .from("conversations")
                .update({
                  status: "running",
                  active_flow_id: null,
                  current_node_id: null,
                  flow_node_queue: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conversationId);
              // Fall through to trigger matching / AI below
            } else {

            const selectedHandleId =
              message.interactive?.button_reply?.id ||
              message.interactive?.list_reply?.id ||
              null;

            const { data: flowData } = await supabase
              .from("flows")
              .select("nodes")
              .eq("organization_id", organizationId)
              .eq("id", existing.active_flow_id)
              .single();

            let promptMessage = "";
            let currentNodeType = "";
            let hasExplicitRoutes = false;
            if (flowData?.nodes) {
              const nodes = flowData.nodes as Array<{
                id: string;
                data: {
                  type?: string;
                  promptMessage?: string;
                  routes?: unknown[];
                };
              }>;
              const currentNode = nodes.find((n) => n.id === existing.current_node_id);
              promptMessage = currentNode?.data?.promptMessage || "";
              currentNodeType = currentNode?.data?.type || "";
              hasExplicitRoutes =
                Array.isArray(currentNode?.data?.routes) &&
                currentNode.data.routes.length > 0;
            }

            if (currentNodeType === "waitTimer") {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            if (currentNodeType === "aiCollector") {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            if (currentNodeType === "whatsappFlow") {
              // WhatsApp Flow form response via nfm_reply
              const flowResponseData =
                (message as Record<string, unknown>).__flowResponseData as
                  | Record<string, string>
                  | undefined;

              if (flowResponseData) {
                // Inject form fields as flow variables with prefix
                const { data: convVars } = await supabase
                  .from("conversations")
                  .select("flow_variables")
                  .eq("id", conversationId)
                  .single();

                const vars =
                  (convVars?.flow_variables as Record<string, string>) || {};
                const prefix = vars.__whatsappFlow_prefix || "flow";

                for (const [key, value] of Object.entries(flowResponseData)) {
                  if (key !== "flow_token") {
                    vars[`${prefix}_${key}`] = String(value);
                  }
                }
                vars[`${prefix}_response`] = JSON.stringify(flowResponseData);

                await supabase
                  .from("conversations")
                  .update({ flow_variables: vars })
                  .eq("id", conversationId);
              }

              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            if (currentNodeType === "sendMessage") {
              if (selectedHandleId) {
                await resumeFlow(supabase, conversationId, contactPhone, content, {
                  selectedHandleId,
                  inboundMessageId: message.id,
                  organizationId,
                  metaConfig,
                });
                continue;
              }

              const triggerMatch = await findMatchingFlow(
                supabase,
                content,
                false,
                organizationId,
                conversationId
              );
              if (triggerMatch) {
                await executeFlow(
                  supabase,
                  conversationId,
                  contactPhone,
                  triggerMatch.flow,
                  triggerMatch.triggerNode,
                  {
                    inboundMessageId: message.id,
                    organizationId,
                    metaConfig,
                  }
                );
                continue;
              }

              const aiCoachResp = await generateCoachResponse(
                supabase,
                conversationId,
                content,
                organizationId
              );
              await simulateTyping(message.id, aiCoachResp.message, metaConfig);
              const aiCoachResult = await sendMetaWhatsAppTextMessage(
                {
                  to: contactPhone,
                  body: aiCoachResp.message,
                },
                metaConfig
              );
              await supabase.from("messages").insert({
                conversation_id: conversationId,
                content: aiCoachResp.message,
                type: "text",
                sender: "bot",
                wa_message_id: aiCoachResult.messageId,
              });
              if (aiCoachResp.profileUpdates) {
                const { data: cvars } = await supabase.from("conversations").select("flow_variables").eq("id", conversationId).single();
                const fv = (cvars?.flow_variables as Record<string, string>) || {};
                const cur = fv._coaching_summary ? JSON.parse(fv._coaching_summary) : {};
                const valid = validateProfileUpdates(aiCoachResp.profileUpdates, cur);
                if (valid) fv._coaching_summary = JSON.stringify({ ...cur, ...valid });
                await supabase.from("conversations").update({ flow_variables: fv }).eq("id", conversationId);
              }
              continue;
            }

            if (hasExplicitRoutes) {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            const intent = promptMessage
              ? await classifyFlowIntent(promptMessage, content)
              : "ANSWER";

            if (intent === "ANSWER") {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
            } else {
              const aiResp2 = await generateCoachResponse(
                supabase,
                conversationId,
                content,
                organizationId
              );
              await simulateTyping(message.id, aiResp2.message, metaConfig);
              const aiResult = await sendMetaWhatsAppTextMessage(
                {
                  to: contactPhone,
                  body: aiResp2.message,
                },
                metaConfig
              );
              await supabase.from("messages").insert({
                conversation_id: conversationId,
                content: aiResp2.message,
                type: "text",
                sender: "bot",
                wa_message_id: aiResult.messageId,
              });
              if (aiResp2.profileUpdates) {
                const { data: cvars2 } = await supabase.from("conversations").select("flow_variables").eq("id", conversationId).single();
                const fv2 = (cvars2?.flow_variables as Record<string, string>) || {};
                const cur2 = fv2._coaching_summary ? JSON.parse(fv2._coaching_summary) : {};
                const valid2 = validateProfileUpdates(aiResp2.profileUpdates, cur2);
                if (valid2) fv2._coaching_summary = JSON.stringify({ ...cur2, ...valid2 });
                await supabase.from("conversations").update({ flow_variables: fv2 }).eq("id", conversationId);
              }

              if (promptMessage) {
                const { data: convVars } = await supabase
                  .from("conversations")
                  .select("flow_variables")
                  .eq("id", conversationId)
                  .single();
                const vars = (convVars?.flow_variables as Record<string, string>) || {};
                const interpolated = promptMessage.replace(
                  /\{\{(\w+)\}\}/g,
                  (_, key: string) => vars[key] || `{{${key}}}`
                );

                await simulateTyping(message.id, interpolated, metaConfig);
                const promptResult = await sendMetaWhatsAppTextMessage(
                  {
                    to: contactPhone,
                    body: interpolated,
                  },
                  metaConfig
                );
                await supabase.from("messages").insert({
                  conversation_id: conversationId,
                  content: interpolated,
                  type: "text",
                  sender: "bot",
                  wa_message_id: promptResult.messageId,
                });
              }
            }
            continue;
            } // end else (flow still active)
          }

          const match = await findMatchingFlow(
            supabase,
            content,
            isNewContact,
            organizationId,
            conversationId
          );

          if (match) {
            await executeFlow(
              supabase,
              conversationId,
              contactPhone,
              match.flow,
              match.triggerNode,
              {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              }
            );
            continue;
          }

          // Check subscription for AI access
          const hasActiveSubscription =
            (existing?.subscription_status === "active" || existing?.subscription_status === "trial") &&
            existing?.subscription_expires_at &&
            new Date(existing.subscription_expires_at as string) > new Date();

          if (!hasActiveSubscription) {
            const nudgeMsg = resolvedOrganization.settings?.subscription_nudge_message
              || "Para ter acompanhamento contínuo com a IA, assine o plano Premium! Envie 'assinar' para saber mais.";
            await sendMetaWhatsAppTextMessage({ to: contactPhone, body: nudgeMsg }, metaConfig);
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              content: nudgeMsg,
              type: "text",
              sender: "bot",
            });
            continue;
          }

          if (!existing || !existing.ai_enabled) {
            await supabase
              .from("conversations")
              .update({ status: "ai", ai_enabled: true, updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          }

          const aiResp3 = await generateCoachResponse(
            supabase,
            conversationId,
            content,
            organizationId
          );
          await simulateTyping(message.id, aiResp3.message, metaConfig);
          const result = await sendMetaWhatsAppTextMessage(
            {
              to: contactPhone,
              body: aiResp3.message,
            },
            metaConfig
          );
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: aiResp3.message,
            type: "text",
            sender: "bot",
            wa_message_id: result.messageId,
          });
          if (aiResp3.profileUpdates) {
            const { data: cvars3 } = await supabase.from("conversations").select("flow_variables").eq("id", conversationId).single();
            const fv3 = (cvars3?.flow_variables as Record<string, string>) || {};
            const cur3 = fv3._coaching_summary ? JSON.parse(fv3._coaching_summary) : {};
            const valid3 = validateProfileUpdates(aiResp3.profileUpdates, cur3);
            if (valid3) fv3._coaching_summary = JSON.stringify({ ...cur3, ...valid3 });
            await supabase.from("conversations").update({ flow_variables: fv3 }).eq("id", conversationId);
          }
        } catch (error) {
          console.error("Orchestration error:", error);
        }
      }

      for (const status of value.statuses || []) {
        console.log("Meta WhatsApp status update", {
          messageId: status.id,
          status: status.status,
          recipientId: status.recipient_id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
