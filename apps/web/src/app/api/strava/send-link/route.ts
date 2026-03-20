import { NextResponse } from "next/server";
import {
  getConversationOrganizationContext,
  getCurrentOrganizationContext,
} from "@/lib/organization";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTextMessage,
} from "@/lib/meta";
import {
  buildStravaConnectMessage,
  buildStravaConnectUrl,
} from "@/lib/strava";

export async function POST(request: Request) {
  try {
    const context = await getCurrentOrganizationContext();
    const body = (await request.json()) as { conversationId?: string };
    if (!body.conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const conversationContext = await getConversationOrganizationContext(
      body.conversationId
    );
    if (conversationContext.organizationId !== context.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { configured, missing, config } = getMetaConfigFromSettings(
      conversationContext.settings
    );
    if (!configured) {
      return NextResponse.json(
        { error: "Meta Cloud API credentials not configured", missing },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();
    const { data: conversation } = await supabase
      .from("conversations")
      .select("contact_phone")
      .eq("organization_id", context.organizationId)
      .eq("id", body.conversationId)
      .single();

    if (!conversation?.contact_phone) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const connectUrl = buildStravaConnectUrl({
      conversationId: body.conversationId,
      requestUrl: request.url,
    });
    const message = buildStravaConnectMessage(connectUrl);

    const result = await sendMetaWhatsAppTextMessage(
      {
        to: conversation.contact_phone,
        body: message,
      },
      config
    );

    await supabase.from("messages").insert({
      conversation_id: body.conversationId,
      content: message,
      type: "text",
      sender: "bot",
      wa_message_id: result.messageId,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", body.conversationId);

    return NextResponse.json({ success: true, connectUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send Strava link",
      },
      { status: 500 }
    );
  }
}
