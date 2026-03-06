import { NextResponse } from "next/server";
import { getMetaConfig, sendMetaWhatsAppTextMessage } from "@/lib/meta";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { configured, missing } = getMetaConfig();

  if (!configured) {
    return NextResponse.json(
      { error: "Meta Cloud API credentials not configured", missing },
      { status: 400 }
    );
  }

  const body = await request.json();

  if (!body.conversationId || !body.text) {
    return NextResponse.json(
      { error: "Fields 'conversationId' and 'text' are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("contact_phone, status")
    .eq("id", body.conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  try {
    const result = await sendMetaWhatsAppTextMessage({
      to: conversation.contact_phone,
      body: body.text,
    });

    await supabase.from("messages").insert({
      conversation_id: body.conversationId,
      content: body.text,
      type: "text",
      sender: "human",
      wa_message_id: result.messageId,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", body.conversationId);

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to send message: ${error}` },
      { status: 500 }
    );
  }
}
