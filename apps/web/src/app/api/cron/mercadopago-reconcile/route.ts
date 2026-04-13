export const maxDuration = 60;

import { NextResponse } from "next/server";
import { validateCronAuthorization } from "@/lib/internal-auth";
import { getOrganizationSettingsById } from "@/lib/organization";
import { reconcilePendingMercadoPagoPayments } from "@/lib/mercado-pago-reconciliation";
import { createServerClient } from "@/lib/supabase/server";

type OrganizationSettingsRow = {
  organization_id: string;
  mercado_pago_access_token: string | null;
};

export async function GET(request: Request) {
  const auth = validateCronAuthorization(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("organization_id, mercado_pago_access_token");

  if (error) {
    console.error("[mercadopago cron] failed to load organizations", error);
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }

  const organizations = ((data || []) as OrganizationSettingsRow[]).filter(
    (row) => !!row.organization_id && !!row.mercado_pago_access_token?.trim()
  );

  if (organizations.length === 0) {
    return NextResponse.json({ processed: 0, organizations: 0 });
  }

  let processed = 0;
  const summaries: Array<{
    organizationId: string;
    reconciled: number;
  }> = [];

  for (const row of organizations) {
    try {
      const settings = await getOrganizationSettingsById(row.organization_id);
      const results = await reconcilePendingMercadoPagoPayments({
        supabase,
        organizationId: row.organization_id,
        settings,
        limit: 20,
      });

      const reconciled = results.filter((result) => result.status === "approved").length;
      processed += reconciled;
      summaries.push({
        organizationId: row.organization_id,
        reconciled,
      });
    } catch (reconcileError) {
      console.error(
        `[mercadopago cron] failed for organization ${row.organization_id}`,
        reconcileError
      );
    }
  }

  return NextResponse.json({
    processed,
    organizations: organizations.length,
    summaries,
  });
}
