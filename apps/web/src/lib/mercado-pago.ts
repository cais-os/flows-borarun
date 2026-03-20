import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationSettings } from "./organization";
import { resolveAppOrigin } from "./strava";

const MP_API_BASE = "https://api.mercadopago.com";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type MercadoPagoConfig = {
  accessToken: string;
  publicKey: string | null;
};

export function getMercadoPagoConfig(
  settings: OrganizationSettings | null
): { configured: boolean; config: MercadoPagoConfig | null } {
  if (!settings?.mercado_pago_access_token) {
    return { configured: false, config: null };
  }
  return {
    configured: true,
    config: {
      accessToken: settings.mercado_pago_access_token,
      publicKey: settings.mercado_pago_public_key ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Create preference + payment record
// ---------------------------------------------------------------------------

export interface CreatePaymentParams {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  planName: string;
  amount: number;
  durationDays: number;
  currency: string;
  accessToken: string;
}

export async function createPaymentAndPreference(
  params: CreatePaymentParams
): Promise<{ initPoint: string; paymentRecordId: string }> {
  // 1. Insert pending payment record
  const { data: payment, error: insertErr } = await params.supabase
    .from("payments")
    .insert({
      organization_id: params.organizationId,
      conversation_id: params.conversationId,
      mp_preference_id: "pending",
      plan_name: params.planName,
      amount: params.amount,
      duration_days: params.durationDays,
      currency: params.currency,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !payment) {
    throw new Error(`Failed to create payment record: ${insertErr?.message}`);
  }

  const paymentRecordId = payment.id as string;

  // 2. Build external reference (so webhook can resolve context)
  const externalReference = JSON.stringify({
    paymentRecordId,
    conversationId: params.conversationId,
    organizationId: params.organizationId,
  });

  const origin = resolveAppOrigin();

  // 3. Create Mercado Pago preference
  const body = {
    items: [
      {
        title: params.planName,
        unit_price: params.amount,
        quantity: 1,
        currency_id: params.currency,
      },
    ],
    back_urls: {
      success: `${origin}/mercadopago/status?s=success`,
      failure: `${origin}/mercadopago/status?s=failure`,
      pending: `${origin}/mercadopago/status?s=pending`,
    },
    notification_url: `${origin}/api/mercadopago/webhook?org=${params.organizationId}`,
    external_reference: externalReference,
    auto_return: "approved",
  };

  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mercado Pago preference creation failed (${res.status}): ${errText}`);
  }

  const preference = (await res.json()) as {
    id: string;
    init_point: string;
  };

  // 4. Update payment record with preference id
  await params.supabase
    .from("payments")
    .update({ mp_preference_id: preference.id })
    .eq("id", paymentRecordId);

  return { initPoint: preference.init_point, paymentRecordId };
}

// ---------------------------------------------------------------------------
// Fetch payment details from Mercado Pago
// ---------------------------------------------------------------------------

export interface MercadoPagoPayment {
  id: number;
  status: string; // approved | pending | rejected | in_process | cancelled
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
  payer: { email: string } | null;
}

export async function fetchMercadoPagoPayment(
  paymentId: string,
  accessToken: string
): Promise<MercadoPagoPayment> {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch MP payment ${paymentId} (${res.status}): ${errText}`);
  }

  return (await res.json()) as MercadoPagoPayment;
}

// ---------------------------------------------------------------------------
// Default message
// ---------------------------------------------------------------------------

export function buildPaymentMessage(paymentUrl: string): string {
  return [
    "Para assinar o plano, clique no link abaixo:",
    "",
    paymentUrl,
    "",
    "Apos o pagamento, sua assinatura sera ativada automaticamente.",
  ].join("\n");
}
