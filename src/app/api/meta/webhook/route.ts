import { NextResponse } from "next/server";
import {
  getMetaConfig,
  markMessageAsRead,
  sendMetaWhatsAppTextMessage,
  sendTypingIndicator,
  validateMetaWebhookSignature,
  validateMetaWebhookVerifyToken,
} from "@/lib/meta";
import { createServerClient } from "@/lib/supabase/server";
import { findMatchingFlow, executeFlow, resumeFlow } from "@/lib/flow-engine";
import { generateCoachResponse } from "@/lib/ai-coach";
import { classifyFlowIntent } from "@/lib/intent-classifier";

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
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string; description?: string };
    };
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

export async function GET(request: Request) {
  const { configured, missing } = getMetaConfig();

  if (!configured) {
    return NextResponse.json(
      {
        error: "Meta Cloud API credentials not configured",
        missing,
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && validateMetaWebhookVerifyToken(verifyToken)) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid webhook verification" }, { status: 403 });
}

export async function POST(request: Request) {
  const { configured, missing } = getMetaConfig();

  if (!configured) {
    return NextResponse.json(
      {
        error: "Meta Cloud API credentials not configured",
        missing,
      },
      { status: 400 }
    );
  }

  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  if (!validateMetaWebhookSignature(signature, rawBody)) {
    return NextResponse.json({ error: "Invalid Meta signature" }, { status: 403 });
  }

  const payload = JSON.parse(rawBody) as MetaWebhookPayload;

  const supabase = createServerClient();

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      for (const message of value.messages || []) {
        const contactPhone = message.from || "";
        const contactName =
          value.contacts?.[0]?.profile?.name || contactPhone;
        const phoneNumberId = value.metadata?.phone_number_id || null;

        // Find or create conversation by contact phone
        let conversationId: string;
        let isNewContact = false;
        const { data: existing } = await supabase
          .from("conversations")
          .select("id, status, ai_enabled, active_flow_id, current_node_id")
          .eq("contact_phone", contactPhone)
          .single();

        const conversationStatus = existing?.status || "running";

        if (existing) {
          conversationId = existing.id;
        } else {
          isNewContact = true;
          const { data: created } = await supabase
            .from("conversations")
            .insert({
              contact_name: contactName,
              contact_phone: contactPhone,
              phone_number_id: phoneNumberId,
              status: "running",
            })
            .select("id")
            .single();
          conversationId = created!.id;
        }

        // Extract message content
        let content = "";
        let type: string = message.type || "text";
        if (type === "text") {
          content = message.text?.body || "";
        } else if (type === "interactive") {
          const btnReply = message.interactive?.button_reply;
          const listReply = message.interactive?.list_reply;
          content = btnReply?.title || listReply?.title || "";
          type = "text";
        }

        // Insert inbound message
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

        // Mark message as read (blue check marks)
        if (message.id) {
          markMessageAsRead(message.id).catch(() => {});
        }

        console.log("Meta WhatsApp inbound message saved", {
          conversationId,
          from: contactPhone,
          type: message.type,
          content,
        });

        // --- ORCHESTRATION ---
        // If conversation is taken over by human operator, do nothing
        if (conversationStatus === "human") {
          continue;
        }

        try {
          // 1. Flow is paused waiting for user reply
          if (
            conversationStatus === "paused" &&
            existing?.active_flow_id &&
            existing?.current_node_id
          ) {
            const selectedHandleId =
              message.interactive?.button_reply?.id ||
              message.interactive?.list_reply?.id ||
              null;

            // Get the current paused node to decide how the flow resumes
            const { data: flowData } = await supabase
              .from("flows")
              .select("nodes")
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

            if (currentNodeType === "sendMessage") {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                selectedHandleId,
                inboundMessageId: message.id,
              });
              continue;
            }

            if (hasExplicitRoutes) {
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
              });
              continue;
            }

            // Classify: is user answering the flow question or asking something off-topic?
            const intent = promptMessage
              ? await classifyFlowIntent(promptMessage, content)
              : "ANSWER";

            if (intent === "ANSWER") {
              console.log("Flow resumed with answer:", content);
              await resumeFlow(supabase, conversationId, contactPhone, content, {
                inboundMessageId: message.id,
              });
            } else {
              // OFF_TOPIC: AI responds to the question, then re-sends the flow prompt
              console.log("Off-topic during paused flow, AI responding");
              const aiResponse = await generateCoachResponse(
                supabase,
                conversationId,
                content
              );
              if (message.id) await sendTypingIndicator(message.id).catch(() => {});
              const aiResult = await sendMetaWhatsAppTextMessage({
                to: contactPhone,
                body: aiResponse,
              });
              await supabase.from("messages").insert({
                conversation_id: conversationId,
                content: aiResponse,
                type: "text",
                sender: "bot",
                wa_message_id: aiResult.messageId,
              });

              // Re-send the flow prompt so user knows the flow is still waiting
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

                if (message.id) await sendTypingIndicator(message.id).catch(() => {});
                const promptResult = await sendMetaWhatsAppTextMessage({
                  to: contactPhone,
                  body: interpolated,
                });
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
          }

          // 2. Check flow triggers (even if AI is active)
          const match = await findMatchingFlow(supabase, content, isNewContact);

          if (match) {
            console.log("Flow matched:", match.flow.name);
            await executeFlow(
              supabase,
              conversationId,
              contactPhone,
              match.flow,
              match.triggerNode,
              message.id
            );
            continue;
          }

          // 3. No flow matched → respond with AI coach
          if (!existing || !existing.ai_enabled) {
            await supabase
              .from("conversations")
              .update({ status: "ai", ai_enabled: true, updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          }

          const aiResponse = await generateCoachResponse(
            supabase,
            conversationId,
            content
          );
          if (message.id) await sendTypingIndicator(message.id).catch(() => {});
          const result = await sendMetaWhatsAppTextMessage({
            to: contactPhone,
            body: aiResponse,
          });
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: aiResponse,
            type: "text",
            sender: "bot",
            wa_message_id: result.messageId,
          });
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
