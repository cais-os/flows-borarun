export const maxDuration = 60;

import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  downloadMetaMedia,
  getMetaConfig,
  getMetaConfigFromSettings,
  markMessageAsRead,
  sendMetaWhatsAppCtaUrlMessage,
  sendMetaWhatsAppTextMessage,
  type MetaConfig,
  sendTypingIndicator,
  sendMetaWhatsAppInteractiveListMessage,
  validateMetaWebhookSignature,
  validateMetaWebhookVerifyToken,
} from "@/lib/meta";
import { createServerClient } from "@/lib/supabase/server";
import {
  continueFlowQueue,
  findMatchingFlow,
  executeFlow,
  resumeFlow,
} from "@/lib/flow-engine";
import { generateCoachResponse, validateProfileUpdates } from "@/lib/ai-coach";
import { classifyFlowIntent } from "@/lib/intent-classifier";
import { persistConversationMessage } from "@/lib/conversation-messages";
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
import {
  buildSubscriptionCancellationUrl,
  createSubscriptionCancellationToken,
  detectSubscriptionCancellationIntent,
  findCancellableSubscriptionForConversation,
  formatSubscriptionValidity,
  hasConversationSubscriptionAccess,
} from "@/lib/subscription-utils";

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
        // Skip reactions (emoji on a message) — they are not real messages
        if (message.type === "reaction") continue;

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

        if (message.id) {
          markMessageAsRead(message.id, metaConfig).catch(() => {});
        }

        if (conversationStatus === "human") {
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
          continue;
        }

        // Guard: skip all bot processing when a flow is actively executing.
        // The message is already saved above — we just don't want to trigger
        // a new flow or AI response that would interrupt the running flow.
        if (conversationStatus === "running" && existing?.active_flow_id) {
          const { data: freshConv } = await supabase
            .from("conversations")
            .select(
              "status, active_flow_id, current_node_id, flow_node_queue, updated_at"
            )
            .eq("id", conversationId)
            .single();

          if (freshConv?.status === "running" && freshConv.active_flow_id) {
            const updatedAt = new Date(freshConv.updated_at as string).getTime();
            const stalenessMs = 2 * 60 * 1000;
            const queueIds = Array.isArray(freshConv.flow_node_queue)
              ? freshConv.flow_node_queue.filter(
                  (value): value is string =>
                    typeof value === "string" && value.length > 0
                )
              : [];
            const hasCheckpoint =
              (typeof freshConv.current_node_id === "string" &&
                freshConv.current_node_id.length > 0) ||
              queueIds.length > 0;

            if (!hasCheckpoint) {
              console.warn(
                "[webhook] broken running flow without checkpoint, resetting",
                {
                  conversationId,
                  activeFlowId: freshConv.active_flow_id,
                }
              );
              await supabase
                .from("flow_executions")
                .update({
                  status: "abandoned",
                  completed_at: new Date().toISOString(),
                })
                .eq("conversation_id", conversationId)
                .eq("flow_id", freshConv.active_flow_id)
                .eq("status", "running");
              await supabase
                .from("conversations")
                .update({
                  status: "ai",
                  active_flow_id: null,
                  current_node_id: null,
                  flow_node_queue: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conversationId);
            } else if (Date.now() - updatedAt < stalenessMs) {
              console.log("[webhook] flow actively running, skipping processing", {
                conversationId,
                activeFlowId: freshConv.active_flow_id,
                content: content.substring(0, 50),
              });
              continue;
            }

            // Stale — clean up crashed/timed-out flow
            console.warn("[webhook] stale running flow, retrying continuation", {
              conversationId,
              activeFlowId: freshConv.active_flow_id,
              staleDurationMs: Date.now() - updatedAt,
              queueLength: queueIds.length,
              currentNodeId: freshConv.current_node_id,
            });
            try {
              await continueFlowQueue(supabase, conversationId, contactPhone, {
                organizationId,
                metaConfig,
              });
              continue;
            } catch (error) {
              console.error("[webhook] failed to continue stale running flow", {
                conversationId,
                activeFlowId: freshConv.active_flow_id,
                error,
              });
              await supabase
                .from("flow_executions")
                .update({
                  status: "abandoned",
                  completed_at: new Date().toISOString(),
                })
                .eq("conversation_id", conversationId)
                .eq("flow_id", freshConv.active_flow_id)
                .eq("status", "running");
              await supabase
                .from("conversations")
                .update({
                  status: "ai",
                  active_flow_id: null,
                  current_node_id: null,
                  flow_node_queue: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conversationId);
            }
          }
          // If status changed (flow completed between reads), fall through
        }

        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

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

          // Weekly training preference capture (after payment)
          {
            const { data: prefConv } = await supabase
              .from("conversations")
              .select("flow_variables")
              .eq("id", conversationId)
              .single();
            const prefVars = (prefConv?.flow_variables as Record<string, string>) || {};

            if (prefVars._awaiting_weekly_day === "true") {
              const listReplyId = message.interactive?.list_reply?.id || content;
              const dayMatch = listReplyId.match(/day_(\d)/);
              if (dayMatch) {
                prefVars._weekly_training_day = dayMatch[1];
                delete prefVars._awaiting_weekly_day;
                prefVars._awaiting_weekly_hour = "true";
                await supabase.from("conversations").update({ flow_variables: prefVars }).eq("id", conversationId);

                // Ask for preferred hour
                const hourPrompt = "E em qual horario prefere receber?";
                const hourResult = await sendMetaWhatsAppInteractiveListMessage(
                  {
                    to: contactPhone,
                    body: hourPrompt,
                    buttonText: "Escolher horario",
                    sectionTitle: "Horarios",
                    items: [
                      { id: "hour_06", title: "06:00" },
                      { id: "hour_07", title: "07:00" },
                      { id: "hour_08", title: "08:00" },
                      { id: "hour_09", title: "09:00" },
                      { id: "hour_18", title: "18:00" },
                      { id: "hour_19", title: "19:00" },
                      { id: "hour_20", title: "20:00" },
                    ],
                  },
                  metaConfig
                );

                await persistConversationMessage({
                  supabase,
                  conversationId,
                  content: hourPrompt,
                  type: "interactive",
                  sender: "bot",
                  waMessageId: hourResult.messageId,
                  metadata: {
                    whatsapp_interactive_kind: "list",
                    whatsapp_button_text: "Escolher horario",
                  },
                });
                continue;
              }
            }

            if (prefVars._awaiting_weekly_hour === "true") {
              const listReplyId = message.interactive?.list_reply?.id || content;
              const hourMatch = listReplyId.match(/hour_(\d+)/);
              if (hourMatch) {
                prefVars._weekly_training_hour = `${hourMatch[1]}:00`;
                prefVars._weekly_training_enabled = "true";
                delete prefVars._awaiting_weekly_hour;
                await supabase.from("conversations").update({ flow_variables: prefVars }).eq("id", conversationId);

                const weeklyReadyText = [
                  "Perfeito! Voce vai receber seus treinos atualizados toda semana.",
                  "",
                  "Com a assistencia de corrida, voce pode:",
                  "- tirar duvidas sobre os seus treinos",
                  "- pedir ajustes quando estiver cansado, com dor ou sem tempo",
                  "- entender melhor ritmo, pace, volume e estrategia de prova",
                  "- conversar sobre recuperacao, consistencia e evolucao",
                  "",
                  "Quando quiser, ja pode comecar a me chamar por aqui.",
                ].join("\n");
                const weeklyReadyResult = await sendMetaWhatsAppTextMessage(
                  { to: contactPhone, body: weeklyReadyText },
                  metaConfig
                );
                await persistConversationMessage({
                  supabase,
                  conversationId,
                  content: weeklyReadyText,
                  type: "text",
                  sender: "bot",
                  waMessageId: weeklyReadyResult.messageId,
                });
                continue;
              }
            }
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

            if (currentNodeType === "agenticLoop") {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            if (currentNodeType === "stravaConnect") {
              const buttonId = message.interactive?.button_reply?.id;
              if (buttonId === "strava_retry") {
                // User wants to retry — resend the Strava connect link
                const { buildStravaConnectUrl, buildStravaConnectMessage } = await import("@/lib/strava");
                const connectUrl = buildStravaConnectUrl({ conversationId });
                const retryMsg = buildStravaConnectMessage(connectUrl);
                await sendMetaWhatsAppTextMessage({ to: contactPhone, body: retryMsg }, metaConfig);
                await supabase.from("messages").insert({
                  conversation_id: conversationId,
                  content: retryMsg,
                  type: "text",
                  sender: "bot",
                });
                // Stay paused — don't resume
                continue;
              }
              // "strava_skip" or any other message — resume flow without Strava
              await resumeFlow(supabase, conversationId, contactPhone, content || "strava_skip", {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            if (currentNodeType === "waitForPlayed") {
              // User sent a message while waiting for audio to be played — resume
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

              if (!flowResponseData) {
                console.log("[meta/webhook] ignoring message while waiting for WhatsApp Flow response", {
                  conversationId,
                  messageId: message.id,
                  messageType: message.type,
                  interactiveType: message.interactive?.type || null,
                });
                continue;
              }

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

              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
              continue;
            }

            if (currentNodeType === "sendMessage") {
              // Whether the user clicked a button/list item or sent free text,
              // delegate to resumeFlow. If interactive options exist and no
              // selection was made, resumeFlow re-prompts and keeps the flow
              // paused instead of abandoning it.
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                selectedHandleId: selectedHandleId || undefined,
                inboundMessageId: message.id,
                organizationId,
                metaConfig,
              });
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

          if (type === "text" && detectSubscriptionCancellationIntent(content)) {
            const cancellableSubscription =
              await findCancellableSubscriptionForConversation({
                supabase,
                conversationId,
                organizationId,
              });

            if (cancellableSubscription?.subscriptionStatus === "cancelled") {
              const validUntil = formatSubscriptionValidity(
                cancellableSubscription.expiresAt
              );
              const alreadyCancelledMsg = [
                "Sua renovacao automatica ja esta cancelada.",
                validUntil
                  ? `Seu acesso continua ativo ate ${validUntil}.`
                  : null,
              ]
                .filter(Boolean)
                .join(" ");
              await simulateTyping(message.id, alreadyCancelledMsg, metaConfig);
              const alreadyCancelledResult = await sendMetaWhatsAppTextMessage(
                {
                  to: contactPhone,
                  body: alreadyCancelledMsg,
                },
                metaConfig
              );
              await supabase.from("messages").insert({
                conversation_id: conversationId,
                content: alreadyCancelledMsg,
                type: "text",
                sender: "bot",
                wa_message_id: alreadyCancelledResult.messageId,
              });
              continue;
            }

            if (cancellableSubscription) {
              const token = createSubscriptionCancellationToken({
                paymentRecordId: cancellableSubscription.paymentRecordId,
                conversationId,
                organizationId,
                subscriptionId: cancellableSubscription.subscriptionId,
                paymentProvider: cancellableSubscription.paymentProvider,
              });

              if (token) {
                const cancellationUrl =
                  buildSubscriptionCancellationUrl(token);
                const validUntil = formatSubscriptionValidity(
                  cancellableSubscription.expiresAt
                );
                const cancellationText = [
                  "Posso te ajudar com isso.",
                  "Se quiser cancelar a renovacao automatica do Premium, toque no botao abaixo.",
                  validUntil
                    ? `Seu acesso atual continua normalmente ate ${validUntil}.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ");

                await simulateTyping(message.id, cancellationText, metaConfig);
                const cancelResult = await sendMetaWhatsAppCtaUrlMessage(
                  {
                    to: contactPhone,
                    bodyText: cancellationText,
                    buttonText: "Cancelar assinatura",
                    url: cancellationUrl,
                  },
                  metaConfig
                );

                await persistConversationMessage({
                  supabase,
                  conversationId,
                  content: cancellationText,
                  type: "interactive",
                  sender: "bot",
                  waMessageId: cancelResult.messageId,
                  metadata: {
                    cancellation_url: cancellationUrl,
                    whatsapp_interactive_kind: "cta_url",
                    whatsapp_button_text: "Cancelar assinatura",
                  },
                });
                continue;
              }
            }

            const noCancelableSubscriptionMsg =
              "No momento nao encontrei uma assinatura recorrente ativa para cancelar por aqui. Se voce quiser, eu posso te orientar pelo status atual da sua assinatura.";
            await simulateTyping(
              message.id,
              noCancelableSubscriptionMsg,
              metaConfig
            );
            const noCancelableResult = await sendMetaWhatsAppTextMessage(
              {
                to: contactPhone,
                body: noCancelableSubscriptionMsg,
              },
              metaConfig
            );
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              content: noCancelableSubscriptionMsg,
              type: "text",
              sender: "bot",
              wa_message_id: noCancelableResult.messageId,
            });
            continue;
          }

          // Check subscription for AI access
          const hasActiveSubscription = hasConversationSubscriptionAccess(
            existing?.subscription_status,
            existing?.subscription_expires_at as string | null | undefined
          );

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

        // Resume paused flow when user plays an audio we're waiting on
        if (status.status === "played" && status.id) {
          try {
            const { data: msg } = await supabase
              .from("messages")
              .select("conversation_id")
              .eq("wa_message_id", status.id)
              .maybeSingle();

            if (msg?.conversation_id) {
              const { data: conv } = await supabase
                .from("conversations")
                .select("status, flow_variables, contact_phone, organization_id")
                .eq("id", msg.conversation_id)
                .eq("status", "paused")
                .maybeSingle();

              const vars = (conv?.flow_variables as Record<string, string>) || {};
              if (conv && vars.__wait_played_msg_id === status.id) {
                delete vars.__wait_played_msg_id;
                await supabase
                  .from("conversations")
                  .update({ flow_variables: vars, timeout_at: null })
                  .eq("id", msg.conversation_id);

                const orgId = conv.organization_id as string;
                const orgSettings = await getOrganizationSettingsById(orgId);
                const { config: orgMetaConfig } = getMetaConfigFromSettings(orgSettings);

                await resumeFlow(supabase, msg.conversation_id, conv.contact_phone, "", {
                  organizationId: orgId,
                  metaConfig: orgMetaConfig,
                });
                console.log("[webhook] resumed flow after audio played", {
                  conversationId: msg.conversation_id,
                  messageId: status.id,
                });
              }
            }
          } catch (error) {
            console.error("[webhook] failed to resume on audio played", error);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
