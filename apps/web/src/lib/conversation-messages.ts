import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationMessageSender = "bot" | "contact" | "human" | "system";
export type ConversationMessageType =
  | "text"
  | "image"
  | "file"
  | "audio"
  | "video"
  | "template"
  | "system"
  | "interactive";

type PersistConversationMessageParams = {
  supabase: SupabaseClient;
  conversationId: string;
  content: string;
  sender: ConversationMessageSender;
  type: ConversationMessageType;
  nodeId?: string | null;
  waMessageId?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  templateName?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeDbMessageType(type: ConversationMessageType) {
  return type === "interactive" ? "text" : type;
}

function enrichMessageMetadata(params: {
  type: ConversationMessageType;
  metadata?: Record<string, unknown> | null;
}) {
  if (params.type !== "interactive") {
    return params.metadata || null;
  }

  return {
    ...(params.metadata || {}),
    whatsapp_message_type: "interactive",
  };
}

export async function persistConversationMessage(
  params: PersistConversationMessageParams
) {
  const payload = {
    conversation_id: params.conversationId,
    content: params.content,
    type: normalizeDbMessageType(params.type),
    sender: params.sender,
    node_id: params.nodeId || null,
    wa_message_id: params.waMessageId || null,
    media_url: params.mediaUrl || null,
    file_name: params.fileName || null,
    template_name: params.templateName || null,
    metadata: enrichMessageMetadata({
      type: params.type,
      metadata: params.metadata,
    }),
  };

  const { error } = await params.supabase.from("messages").insert(payload);
  if (error) {
    throw error;
  }
}
