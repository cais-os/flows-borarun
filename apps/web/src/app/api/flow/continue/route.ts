export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { continueFlowQueue } from "@/lib/flow-engine";
import { getOrganizationSettingsById } from "@/lib/organization";
import { getMetaConfigFromSettings } from "@/lib/meta";
import { validateInternalSecret } from "@/lib/internal-auth";

/**
 * Internal endpoint to continue a long-running flow from its persisted queue
 * in a fresh function invocation before Vercel's timeout is reached.
 *
 * POST /api/flow/continue
 * Body: { conversationId, contactPhone, organizationId }
 */
export async function POST(request: Request) {
  const auth = validateInternalSecret(request.headers.get("x-internal-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as {
    conversationId: string;
    contactPhone: string;
    organizationId: string;
  };

  const supabase = createServerClient();
  const settings = await getOrganizationSettingsById(body.organizationId);
  const { config: metaConfig } = getMetaConfigFromSettings(settings);

  await continueFlowQueue(
    supabase,
    body.conversationId,
    body.contactPhone,
    {
      organizationId: body.organizationId,
      metaConfig,
    }
  );

  return NextResponse.json({ ok: true });
}
