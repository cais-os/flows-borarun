import { NextResponse } from "next/server";
import {
  getConversationOrganizationContext,
  getCurrentOrganizationContext,
} from "@/lib/organization";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  buildStravaSyncMessage,
  getStravaConnectionSummary,
  syncStravaActivitiesForConversation,
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

    const supabase = await createSupabaseServer();
    const result = await syncStravaActivitiesForConversation(
      supabase,
      body.conversationId,
      { force: true }
    );

    if (!result.connected) {
      return NextResponse.json(
        { error: "Strava not connected for this conversation" },
        { status: 404 }
      );
    }

    const summary = await getStravaConnectionSummary(
      supabase,
      body.conversationId
    );

    return NextResponse.json({
      ...result,
      summary,
      message: buildStravaSyncMessage(summary),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Strava activities",
      },
      { status: 500 }
    );
  }
}
