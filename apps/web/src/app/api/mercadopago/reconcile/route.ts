import { NextResponse } from "next/server";
import { validateInternalSecret } from "@/lib/internal-auth";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  reconcileMercadoPagoPayment,
  reconcileMercadoPagoPaymentByExternalReference,
  reconcileMercadoPagoPaymentByPreferenceId,
  reconcileMercadoPagoPaymentRecord,
  reconcilePendingMercadoPagoPayments,
} from "@/lib/mercado-pago-reconciliation";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = validateInternalSecret(request.headers.get("x-internal-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
    paymentId?: string;
    paymentRecordId?: string;
    preferenceId?: string;
    externalReference?: string;
    limit?: number;
  };

  if (!body.organizationId) {
    return NextResponse.json(
      { error: "organizationId is required" },
      { status: 400 }
    );
  }

  const settings = await getOrganizationSettingsById(body.organizationId);
  const supabase = createServerClient();

  if (body.paymentId) {
    const result = await reconcileMercadoPagoPayment({
      supabase,
      organizationId: body.organizationId,
      settings,
      paymentId: body.paymentId,
      source: "payment",
    });

    return NextResponse.json({ ok: true, result });
  }

  if (body.paymentRecordId) {
    const result = await reconcileMercadoPagoPaymentRecord({
      supabase,
      organizationId: body.organizationId,
      settings,
      paymentRecordId: body.paymentRecordId,
    });

    return NextResponse.json({ ok: true, result });
  }

  if (body.preferenceId) {
    const result = await reconcileMercadoPagoPaymentByPreferenceId({
      supabase,
      organizationId: body.organizationId,
      settings,
      preferenceId: body.preferenceId,
    });

    return NextResponse.json({ ok: true, result });
  }

  if (body.externalReference) {
    const result = await reconcileMercadoPagoPaymentByExternalReference({
      supabase,
      organizationId: body.organizationId,
      settings,
      externalReference: body.externalReference,
      source: "external_reference",
    });

    return NextResponse.json({ ok: true, result });
  }

  const results = await reconcilePendingMercadoPagoPayments({
    supabase,
    organizationId: body.organizationId,
    settings,
    limit: body.limit,
  });

  return NextResponse.json({ ok: true, results });
}
