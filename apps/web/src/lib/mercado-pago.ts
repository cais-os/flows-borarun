import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationSettings } from "./organization";
import { resolveAppOrigin } from "./strava";

const MP_API_BASE = "https://api.mercadopago.com";

export type MercadoPagoConfig = {
  accessToken: string;
  publicKey: string | null;
  webhookSecret: string | null;
};

export type MercadoPagoNotificationPayload = {
  action?: string;
  topic?: string;
  type?: string;
  data?: {
    id?: string | number;
  };
  id?: string | number;
  resource?: string;
};

export type MercadoPagoNotificationKind =
  | "payment"
  | "subscription_authorized_payment"
  | "subscription_preapproval";

export type MercadoPagoBillingMode = "one_time" | "recurring";

type VerifyMercadoPagoWebhookSignatureParams = {
  body: MercadoPagoNotificationPayload;
  requestIdHeader: string | null;
  requestUrl: string;
  secret: string | null;
  signatureHeader: string | null;
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

function getMercadoPagoNotificationType(params: {
  body: MercadoPagoNotificationPayload;
  requestUrl: string;
}) {
  const url = new URL(params.requestUrl);

  return (
    params.body.type ||
    params.body.topic ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    null
  );
}

function getMercadoPagoResourceId(params: {
  body: MercadoPagoNotificationPayload;
  requestUrl: string;
}) {
  const url = new URL(params.requestUrl);

  return (
    (params.body.data?.id !== undefined && params.body.data.id !== null
      ? String(params.body.data.id)
      : null) ||
    (params.body.id !== undefined && params.body.id !== null
      ? String(params.body.id)
      : null) ||
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    params.body.resource?.match(/\/v1\/payments\/(\d+)/)?.[1] ||
    params.body.resource?.match(/\/authorized_payments\/([^/?]+)/)?.[1] ||
    params.body.resource?.match(/\/preapproval\/([^/?]+)/)?.[1] ||
    null
  );
}

export function extractMercadoPagoNotification(params: {
  body: MercadoPagoNotificationPayload;
  requestUrl: string;
}) {
  const notificationType = getMercadoPagoNotificationType(params);
  const resourceId = getMercadoPagoResourceId(params);

  let kind: MercadoPagoNotificationKind | null = null;

  if (
    notificationType === "subscription_authorized_payment" ||
    params.body.resource?.includes("/authorized_payments/")
  ) {
    kind = "subscription_authorized_payment";
  } else if (
    notificationType === "subscription_preapproval" ||
    params.body.resource?.includes("/preapproval/")
  ) {
    kind = "subscription_preapproval";
  } else if (
    notificationType === "payment" ||
    notificationType === "payment.created" ||
    notificationType === "payment.updated" ||
    params.body.action?.startsWith("payment.") ||
    params.body.resource?.includes("/v1/payments/")
  ) {
    kind = "payment";
  }

  return {
    notificationType,
    resourceId,
    kind,
    isSupportedNotification: Boolean(kind && resourceId),
    isSignedWebhookShape:
      params.body.data?.id !== undefined &&
      params.body.data?.id !== null &&
      typeof params.body.type === "string",
  };
}

export function extractMercadoPagoPaymentNotification(params: {
  body: MercadoPagoNotificationPayload;
  requestUrl: string;
}) {
  const notification = extractMercadoPagoNotification(params);

  return {
    notificationType: notification.notificationType,
    paymentId: notification.kind === "payment" ? notification.resourceId : null,
    isPaymentNotification:
      notification.kind === "payment" && Boolean(notification.resourceId),
    isSignedWebhookShape: notification.isSignedWebhookShape,
  };
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

export interface CreatePaymentParams {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  planName: string;
  amount: number;
  durationDays: number;
  currency: string;
  accessToken: string;
  billingMode?: MercadoPagoBillingMode;
  payerEmail?: string | null;
}

type PaymentReference = {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
};

function buildPaymentReference(reference: PaymentReference) {
  return JSON.stringify(reference);
}

function getStatusPageUrl(params: {
  origin: string;
  organizationId: string;
  paymentRecordId: string;
  status?: "success" | "failure" | "pending";
}) {
  const url = new URL(`${params.origin}/mercadopago/status`);
  url.searchParams.set("org", params.organizationId);
  url.searchParams.set("payment_record_id", params.paymentRecordId);
  if (params.status) {
    url.searchParams.set("s", params.status);
  }
  return url.toString();
}

export async function createPaymentAndPreference(
  params: CreatePaymentParams
): Promise<{
  initPoint: string;
  paymentRecordId: string;
  checkoutId: string;
  checkoutType: "preference" | "subscription";
}> {
  const billingMode = params.billingMode || "recurring";

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
      billing_mode: billingMode,
      payer_email: params.payerEmail || null,
    })
    .select("id")
    .single();

  if (insertErr || !payment) {
    throw new Error(`Failed to create payment record: ${insertErr?.message}`);
  }

  const paymentRecordId = payment.id as string;
  const externalReference = buildPaymentReference({
    paymentRecordId,
    conversationId: params.conversationId,
    organizationId: params.organizationId,
  });
  const origin = resolveAppOrigin();

  if (billingMode === "recurring") {
    if (!params.payerEmail) {
      throw new Error(
        "Mercado Pago recurring subscriptions require payer_email. Capture the contact email before this node."
      );
    }

    const body = {
      reason: params.planName,
      external_reference: externalReference,
      payer_email: params.payerEmail,
      back_url: getStatusPageUrl({
        origin,
        organizationId: params.organizationId,
        paymentRecordId,
        status: "pending",
      }),
      notification_url: `${origin}/api/mercadopago/webhook?org=${params.organizationId}&source_news=webhooks`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.amount,
        currency_id: params.currency,
      },
    };

    const res = await fetch(`${MP_API_BASE}/preapproval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Mercado Pago subscription creation failed (${res.status}): ${errText}`
      );
    }

    const subscription = (await res.json()) as {
      id: string;
      init_point: string;
      status?: string;
    };

    await params.supabase
      .from("payments")
      .update({
        mp_preference_id: subscription.id,
        mp_subscription_id: subscription.id,
        mp_subscription_status: subscription.status || "pending",
        billing_mode: billingMode,
        payer_email: params.payerEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecordId);

    return {
      initPoint: subscription.init_point,
      paymentRecordId,
      checkoutId: subscription.id,
      checkoutType: "subscription",
    };
  }

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
      success: getStatusPageUrl({
        origin,
        organizationId: params.organizationId,
        paymentRecordId,
        status: "success",
      }),
      failure: getStatusPageUrl({
        origin,
        organizationId: params.organizationId,
        paymentRecordId,
        status: "failure",
      }),
      pending: getStatusPageUrl({
        origin,
        organizationId: params.organizationId,
        paymentRecordId,
        status: "pending",
      }),
    },
    notification_url: `${origin}/api/mercadopago/webhook?org=${params.organizationId}&source_news=webhooks`,
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
    throw new Error(
      `Mercado Pago preference creation failed (${res.status}): ${errText}`
    );
  }

  const preference = (await res.json()) as {
    id: string;
    init_point: string;
  };

  await params.supabase
    .from("payments")
    .update({
      mp_preference_id: preference.id,
      billing_mode: billingMode,
      payer_email: params.payerEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentRecordId);

  return {
    initPoint: preference.init_point,
    paymentRecordId,
    checkoutId: preference.id,
    checkoutType: "preference",
  };
}

export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
  payer: { email: string } | null;
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  external_reference: string | null;
  notification_url: string | null;
  auto_return: string | null;
}

export interface MercadoPagoSubscription {
  id: string;
  status: string;
  external_reference: string | null;
  init_point: string | null;
  payer_email?: string | null;
  back_url?: string | null;
  reason?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
  } | null;
}

export interface MercadoPagoAuthorizedPayment {
  id: string | number;
  preapproval_id?: string | null;
  external_reference?: string | null;
  status?: string | null;
  payment?: {
    id?: string | number;
  } | null;
}

export async function fetchMercadoPagoPayment(
  paymentId: string,
  accessToken: string
): Promise<MercadoPagoPayment> {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to fetch MP payment ${paymentId} (${res.status}): ${errText}`
    );
  }

  return (await res.json()) as MercadoPagoPayment;
}

export async function fetchMercadoPagoPreference(
  preferenceId: string,
  accessToken: string
): Promise<MercadoPagoPreference> {
  const res = await fetch(
    `${MP_API_BASE}/checkout/preferences/${preferenceId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to fetch MP preference ${preferenceId} (${res.status}): ${errText}`
    );
  }

  return (await res.json()) as MercadoPagoPreference;
}

export async function fetchMercadoPagoSubscription(
  subscriptionId: string,
  accessToken: string
): Promise<MercadoPagoSubscription> {
  const res = await fetch(`${MP_API_BASE}/preapproval/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to fetch MP subscription ${subscriptionId} (${res.status}): ${errText}`
    );
  }

  return (await res.json()) as MercadoPagoSubscription;
}

export async function cancelMercadoPagoSubscription(
  subscriptionId: string,
  accessToken: string
): Promise<MercadoPagoSubscription> {
  const res = await fetch(`${MP_API_BASE}/preapproval/${subscriptionId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to cancel MP subscription ${subscriptionId} (${res.status}): ${errText}`
    );
  }

  return (await res.json()) as MercadoPagoSubscription;
}

export async function fetchMercadoPagoAuthorizedPayment(
  authorizedPaymentId: string,
  accessToken: string
): Promise<MercadoPagoAuthorizedPayment> {
  const res = await fetch(
    `${MP_API_BASE}/authorized_payments/${authorizedPaymentId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to fetch MP authorized payment ${authorizedPaymentId} (${res.status}): ${errText}`
    );
  }

  return (await res.json()) as MercadoPagoAuthorizedPayment;
}

export async function searchMercadoPagoPaymentsByExternalReference(
  externalReference: string,
  accessToken: string
): Promise<MercadoPagoPayment[]> {
  const url = new URL(`${MP_API_BASE}/v1/payments/search`);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("limit", "10");
  url.searchParams.set("external_reference", externalReference);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to search MP payments by external reference (${res.status}): ${errText}`
    );
  }

  const payload = (await res.json()) as {
    results?: MercadoPagoPayment[];
  };

  return payload.results || [];
}

export function buildPaymentMessage(paymentUrl: string): string {
  return [
    "Para assinar o plano, clique no link abaixo:",
    "",
    paymentUrl,
    "",
    "Apos o pagamento, sua assinatura sera ativada automaticamente.",
  ].join("\n");
}
