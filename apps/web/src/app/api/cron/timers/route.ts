export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resumeFlowOnTimeout } from "@/lib/flow-engine";
import { getOrganizationSettingsById } from "@/lib/organization";
import { getMetaConfigFromSettings } from "@/lib/meta";
import { validateCronAuthorization } from "@/lib/internal-auth";

/**
 * Cron endpoint that checks for expired waitTimer nodes.
 * Should be called every minute (e.g. via Vercel Cron or external service).
 *
 * GET /api/cron/timers
 */
export async function GET(request: Request) {
  const auth = validateCronAuthorization(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createServerClient();

  // Find all conversations with expired timers
  const { data: expired, error } = await supabase
    .from("conversations")
    .select("id, contact_phone, organization_id")
    .eq("status", "paused")
    .not("timeout_at", "is", null)
    .lte("timeout_at", new Date().toISOString());

  if (error) {
    console.error("Timer cron: failed to query expired timers", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  console.log(`Timer cron: processing ${expired.length} expired timer(s)`);

  let processed = 0;
  for (const conversation of expired) {
    try {
      const settings = await getOrganizationSettingsById(
        conversation.organization_id as string
      );
      const { config: metaConfig } = getMetaConfigFromSettings(settings);
      await resumeFlowOnTimeout(
        supabase,
        conversation.id,
        conversation.contact_phone,
        conversation.organization_id as string,
        metaConfig
      );
      processed++;
      console.log(`Timer cron: resumed conversation ${conversation.id} (no response)`);
    } catch (error) {
      console.error(
        `Timer cron: failed to resume conversation ${conversation.id}`,
        error
      );
    }
  }

  return NextResponse.json({ processed, total: expired.length });
}
