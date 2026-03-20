import { NextResponse } from "next/server";
import {
  getConversationOrganizationContext,
  getCurrentOrganizationContext,
} from "@/lib/organization";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  buildStravaConnectUrl,
  getStravaConnectionSummary,
} from "@/lib/strava";

export async function GET(request: Request) {
  const context = await getCurrentOrganizationContext();
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  try {
    const conversationContext = await getConversationOrganizationContext(
      conversationId
    );
    if (conversationContext.organizationId !== context.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const summary = await getStravaConnectionSummary(supabase, conversationId);

    return NextResponse.json({
      ...summary,
      connectUrl: buildStravaConnectUrl({
        conversationId,
        requestUrl: request.url,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Strava status",
      },
      { status: 500 }
    );
  }
}
