import { NextResponse } from "next/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  fetchMercadoPagoPreference,
  fetchMercadoPagoSubscription,
  getMercadoPagoConfig,
  type MercadoPagoBillingMode,
} from "@/lib/mercado-pago";
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
      .select("organization_id, billing_mode, mp_preference_id, mp_subscription_id")
      .eq("id", paymentRecordId)
      .maybeSingle();

    if (!paymentRecord) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    const record = paymentRecord as {
      organization_id: string;
      billing_mode: MercadoPagoBillingMode | null;
      mp_preference_id: string | null;
      mp_subscription_id: string | null;
    };

    if (record.organization_id !== orgId) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    if (
      (record.billing_mode || "recurring") === "recurring" &&
      record.mp_subscription_id
    ) {
      const subscription = await fetchMercadoPagoSubscription(
        record.mp_subscription_id,
        mpConfig.config.accessToken
      );

      if (!subscription.init_point) {
        return NextResponse.json(
          { error: "Failed to fetch subscription checkout link" },
          { status: 502 }
        );
      }

      return NextResponse.redirect(subscription.init_point);
    }

    if (record.mp_preference_id && record.mp_preference_id !== "pending") {
      const preference = await fetchMercadoPagoPreference(
        record.mp_preference_id,
        mpConfig.config.accessToken
      );

      return NextResponse.redirect(preference.init_point);
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
