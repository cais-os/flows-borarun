export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resumeFlow } from "@/lib/flow-engine";
import { getOrganizationSettingsById } from "@/lib/organization";
import { getMetaConfigFromSettings } from "@/lib/meta";
import { validateInternalSecret } from "@/lib/internal-auth";

/**
 * Internal endpoint to resume a paused flow in a separate function invocation,
 * avoiding timeout issues when called from heavy handlers like the Strava callback.
 *
 * POST /api/flow/resume
 * Body: { conversationId, contactPhone, userAnswer, organizationId }
 */
export async function POST(request: Request) {
  const auth = validateInternalSecret(request.headers.get("x-internal-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as {
    conversationId: string;
    contactPhone: string;
    userAnswer: string;
    organizationId: string;
  };

  const supabase = createServerClient();
  const settings = await getOrganizationSettingsById(body.organizationId);
  const { config: metaConfig } = getMetaConfigFromSettings(settings);

  await resumeFlow(supabase, body.conversationId, body.contactPhone, body.userAnswer, {
    organizationId: body.organizationId,
    metaConfig,
  });

  return NextResponse.json({ ok: true });
}
