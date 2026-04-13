import { NextResponse } from "next/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  ensureMercadoPagoCheckoutForRecord,
  fetchMercadoPagoPreference,
  getMercadoPagoConfig,
  type MercadoPagoBillingMode,
} from "@/lib/mercado-pago";
import {
  buildMercadoPagoStartUrl,
  createMercadoPagoStartToken,
} from "@/lib/mercado-pago-start";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferenceId = url.searchParams.get("preference_id");
  const paymentRecordId = url.searchParams.get("payment_record_id");
  const orgId = url.searchParams.get("org");

  if ((!preferenceId && !paymentRecordId) || !orgId) {
    return NextResponse.json(
      { error: "Missing payment_record_id/preference_id or org" },
      { status: 400 }
    );
  }

  const settings = await getOrganizationSettingsById(orgId);
  const mpConfig = getMercadoPagoConfig(settings);

  if (!mpConfig.configured || !mpConfig.config) {
    return NextResponse.json(
      { error: "MercadoPago not configured" },
      { status: 400 }
    );
  }

  if (paymentRecordId) {
    const supabase = createServerClient();
    const { data: paymentRecord } = await supabase
      .from("payments")
      .select(
        "id, organization_id, conversation_id, billing_mode, payer_email, mp_preference_id, mp_subscription_id"
      )
      .eq("id", paymentRecordId)
      .maybeSingle();

    if (!paymentRecord) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    const record = paymentRecord as {
      id: string;
      organization_id: string;
      conversation_id: string;
      billing_mode: MercadoPagoBillingMode | null;
      payer_email: string | null;
      mp_preference_id: string | null;
      mp_subscription_id: string | null;
    };

    if (record.organization_id !== orgId) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    if (
      (record.billing_mode || "recurring") === "recurring" &&
      !record.payer_email &&
      !record.mp_subscription_id
    ) {
      const token = createMercadoPagoStartToken({
        paymentRecordId: record.id,
        conversationId: record.conversation_id,
        organizationId: record.organization_id,
      });

      if (!token) {
        return NextResponse.json(
          { error: "Failed to create payment start link" },
          { status: 500 }
        );
      }

      return NextResponse.redirect(buildMercadoPagoStartUrl(token));
    }

    if (
      (record.billing_mode || "recurring") === "recurring" ||
      (record.mp_preference_id && record.mp_preference_id !== "pending")
    ) {
      const checkout = await ensureMercadoPagoCheckoutForRecord({
        supabase,
        paymentRecordId: record.id,
        organizationId: orgId,
        accessToken: mpConfig.config.accessToken,
      });

      return NextResponse.redirect(checkout.initPoint);
    }

    return NextResponse.json(
      { error: "Payment checkout link is not ready yet" },
      { status: 409 }
    );
  }

  const preference = await fetchMercadoPagoPreference(
    preferenceId!,
    mpConfig.config.accessToken
  );

  return NextResponse.redirect(preference.init_point);
}
