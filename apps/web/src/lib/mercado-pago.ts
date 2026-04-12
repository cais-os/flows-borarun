import { createHmac, timingSafeEqual } from "crypto";
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
  webhookSecret: string | null;
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
      webhookSecret:
        settings.mercado_pago_webhook_secret ||
        process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
        null,
    },
  };
}

type VerifyMercadoPagoWebhookSignatureParams = {
  body: {
    data?: {
      id?: string | number;
    };
  };
  requestIdHeader: string | null;
  requestUrl: string;
  secret: string | null;
  signatureHeader: string | null;
};

function parseMercadoPagoSignatureHeader(signatureHeader: string | null) {
  if (!signatureHeader) {
    return null;
  }

  const signatureParts = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const [key, value] = part.split("=", 2);
      if (key && value) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});

  const ts = signatureParts.ts?.trim();
  const v1 = signatureParts.v1?.trim().toLowerCase();

  if (!ts || !v1 || !/^[a-f0-9]+$/i.test(v1)) {
    return null;
  }

  return { ts, v1 };
}

function getMercadoPagoWebhookDataId(
  body: VerifyMercadoPagoWebhookSignatureParams["body"],
  requestUrl: string
) {
  if (body.data?.id !== undefined && body.data.id !== null) {
    return String(body.data.id);
  }

  return new URL(requestUrl).searchParams.get("data.id");
}

function safeCompareHex(expected: string, received: string) {
  if (expected.length !== received.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}

export function verifyMercadoPagoWebhookSignature(
  params: VerifyMercadoPagoWebhookSignatureParams
) {
  if (!params.secret || !params.requestIdHeader) {
    return false;
  }

  const parsedSignature = parseMercadoPagoSignatureHeader(
    params.signatureHeader
  );
  const dataId = getMercadoPagoWebhookDataId(params.body, params.requestUrl);

  if (!parsedSignature || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${params.requestIdHeader};ts:${parsedSignature.ts};`;
  const expectedSignature = createHmac("sha256", params.secret)
    .update(manifest)
    .digest("hex");

  return safeCompareHex(expectedSignature, parsedSignature.v1);
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
