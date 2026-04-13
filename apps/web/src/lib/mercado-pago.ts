import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationSettings } from "./organization";
import {
  buildMercadoPagoStartUrl,
  createMercadoPagoStartToken,
} from "./mercado-pago-start";
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

type StoredPaymentRecord = {
  id: string;
  organization_id: string;
  conversation_id: string;
  plan_name: string | null;
  amount: number | string | null;
  duration_days: number | null;
  currency: string | null;
  status: string | null;
  mp_payment_id: string | null;
  billing_mode: MercadoPagoBillingMode | null;
  payer_email: string | null;
  mp_preference_id: string | null;
  mp_subscription_id: string | null;
  mp_subscription_status: string | null;
  mp_authorized_payment_id: string | null;
  schemaMode: "current" | "legacy";
};

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

function getBillingMode(value: MercadoPagoBillingMode | null | undefined) {
  return value === "one_time" ? "one_time" : "recurring";
}

function isMissingPaymentsColumnError(error: { message?: string } | null | undefined) {
  const message = (error?.message || "").toLowerCase();
  const missingColumns = [
    "billing_mode",
    "payer_email",
    "mp_subscription_id",
    "mp_subscription_status",
    "mp_authorized_payment_id",
  ];

  return missingColumns.some((column) => {
    return (
      message.includes(`column payments.${column} does not exist`) ||
      message.includes(`column \"payments.${column}\" does not exist`) ||
      message.includes(`could not find the '${column}' column of 'payments'`) ||
      (message.includes(column) &&
        message.includes("payments") &&
        message.includes("schema cache"))
    );
  });
}

export function isValidMercadoPagoPayerEmail(
  value: string | null | undefined
) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function createPaymentRecord(params: CreatePaymentParams) {
  const billingMode = params.billingMode || "recurring";

  const modernInsert = await params.supabase
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

  if (!modernInsert.error && modernInsert.data) {
    return modernInsert.data.id as string;
  }

  if (!isMissingPaymentsColumnError(modernInsert.error)) {
    throw new Error(
      `Failed to create payment record: ${modernInsert.error?.message}`
    );
  }

  const legacyInsert = await params.supabase
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

  if (legacyInsert.error || !legacyInsert.data) {
    throw new Error(
      `Failed to create legacy payment record: ${legacyInsert.error?.message}`
    );
  }

  return legacyInsert.data.id as string;
}

export async function loadMercadoPagoPaymentRecord(params: {
  supabase: SupabaseClient;
  paymentRecordId: string;
}) {
  const modernSelect = await params.supabase
    .from("payments")
    .select(
      "id, organization_id, conversation_id, plan_name, amount, duration_days, currency, status, mp_payment_id, billing_mode, payer_email, mp_preference_id, mp_subscription_id, mp_subscription_status, mp_authorized_payment_id"
    )
    .eq("id", params.paymentRecordId)
    .maybeSingle();

  if (!modernSelect.error) {
    const data = modernSelect.data as Omit<StoredPaymentRecord, "schemaMode"> | null;
    return data ? { ...data, schemaMode: "current" as const } : null;
  }

  if (!isMissingPaymentsColumnError(modernSelect.error)) {
    throw new Error(`Failed to load payment record: ${modernSelect.error.message}`);
  }

  const legacySelect = await params.supabase
    .from("payments")
    .select(
      "id, organization_id, conversation_id, plan_name, amount, duration_days, currency, status, mp_payment_id, mp_preference_id"
    )
    .eq("id", params.paymentRecordId)
    .maybeSingle();

  if (legacySelect.error) {
    throw new Error(
      `Failed to load legacy payment record: ${legacySelect.error.message}`
    );
  }

  const legacyData = legacySelect.data as {
    id: string;
    organization_id: string;
    conversation_id: string;
    plan_name: string | null;
    amount: number | string | null;
    duration_days: number | null;
    currency: string | null;
    status: string | null;
    mp_payment_id: string | null;
    mp_preference_id: string | null;
  } | null;

  if (!legacyData) return null;

  return {
    ...legacyData,
    mp_payment_id: legacyData.mp_payment_id,
    billing_mode: null,
    payer_email: null,
    mp_subscription_id: null,
    mp_subscription_status: null,
    mp_authorized_payment_id: null,
    schemaMode: "legacy" as const,
  } satisfies StoredPaymentRecord;
}

async function createRecurringCheckoutForRecord(params: {
  supabase: SupabaseClient;
  paymentRecord: StoredPaymentRecord;
  accessToken: string;
  payerEmail: string;
}) {
  const origin = resolveAppOrigin();
  const externalReference = buildPaymentReference({
    paymentRecordId: params.paymentRecord.id,
    conversationId: params.paymentRecord.conversation_id,
    organizationId: params.paymentRecord.organization_id,
  });

  const body = {
    reason: params.paymentRecord.plan_name || "Assinatura",
    external_reference: externalReference,
    payer_email: params.payerEmail,
    back_url: getStatusPageUrl({
      origin,
      organizationId: params.paymentRecord.organization_id,
      paymentRecordId: params.paymentRecord.id,
      status: "pending",
    }),
    notification_url: `${origin}/api/mercadopago/webhook?org=${params.paymentRecord.organization_id}&source_news=webhooks`,
    status: "pending",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: Number(params.paymentRecord.amount) || 0,
      currency_id: params.paymentRecord.currency || "BRL",
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

  const recurringUpdate =
    params.paymentRecord.schemaMode === "current"
      ? {
          mp_preference_id: subscription.id,
          mp_subscription_id: subscription.id,
          mp_subscription_status: subscription.status || "pending",
          billing_mode: "recurring",
          payer_email: params.payerEmail,
          updated_at: new Date().toISOString(),
        }
      : {
          mp_preference_id: subscription.id,
          updated_at: new Date().toISOString(),
        };

  await params.supabase
    .from("payments")
    .update(recurringUpdate)
    .eq("id", params.paymentRecord.id);

  return {
    initPoint: subscription.init_point,
    paymentRecordId: params.paymentRecord.id,
    checkoutId: subscription.id,
    checkoutType: "subscription" as const,
  };
}

async function createOneTimeCheckoutForRecord(params: {
  supabase: SupabaseClient;
  paymentRecord: StoredPaymentRecord;
  accessToken: string;
  payerEmail?: string | null;
}) {
  const origin = resolveAppOrigin();
  const externalReference = buildPaymentReference({
    paymentRecordId: params.paymentRecord.id,
    conversationId: params.paymentRecord.conversation_id,
    organizationId: params.paymentRecord.organization_id,
  });

  const body = {
    items: [
      {
        title: params.paymentRecord.plan_name || "Assinatura",
        unit_price: Number(params.paymentRecord.amount) || 0,
        quantity: 1,
        currency_id: params.paymentRecord.currency || "BRL",
      },
    ],
    back_urls: {
      success: getStatusPageUrl({
        origin,
        organizationId: params.paymentRecord.organization_id,
        paymentRecordId: params.paymentRecord.id,
        status: "success",
      }),
      failure: getStatusPageUrl({
        origin,
        organizationId: params.paymentRecord.organization_id,
        paymentRecordId: params.paymentRecord.id,
        status: "failure",
      }),
      pending: getStatusPageUrl({
        origin,
        organizationId: params.paymentRecord.organization_id,
        paymentRecordId: params.paymentRecord.id,
        status: "pending",
      }),
    },
    notification_url: `${origin}/api/mercadopago/webhook?org=${params.paymentRecord.organization_id}&source_news=webhooks`,
    external_reference: externalReference,
    auto_return: "approved",
    payer: params.payerEmail ? { email: params.payerEmail } : undefined,
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

  const oneTimeUpdate =
    params.paymentRecord.schemaMode === "current"
      ? {
          mp_preference_id: preference.id,
          billing_mode: "one_time",
          payer_email: params.payerEmail || null,
          updated_at: new Date().toISOString(),
        }
      : {
          mp_preference_id: preference.id,
          updated_at: new Date().toISOString(),
        };

  await params.supabase
    .from("payments")
    .update(oneTimeUpdate)
    .eq("id", params.paymentRecord.id);

  return {
    initPoint: preference.init_point,
    paymentRecordId: params.paymentRecord.id,
    checkoutId: preference.id,
    checkoutType: "preference" as const,
  };
}

export async function ensureMercadoPagoCheckoutForRecord(params: {
  supabase: SupabaseClient;
  paymentRecordId: string;
  organizationId: string;
  accessToken: string;
  payerEmail?: string | null;
}): Promise<{
  initPoint: string;
  paymentRecordId: string;
  checkoutId: string;
  checkoutType: "preference" | "subscription";
}> {
  const paymentRecord = await loadMercadoPagoPaymentRecord({
    supabase: params.supabase,
    paymentRecordId: params.paymentRecordId,
  });

  if (!paymentRecord || paymentRecord.organization_id !== params.organizationId) {
    throw new Error("Payment record not found");
  }

  const billingMode = getBillingMode(paymentRecord.billing_mode);
  const normalizedEmail = isValidMercadoPagoPayerEmail(params.payerEmail)
    ? params.payerEmail!.trim()
    : null;
  const effectiveEmail = normalizedEmail || paymentRecord.payer_email || null;

  if (
    paymentRecord.schemaMode === "current" &&
    normalizedEmail &&
    normalizedEmail !== paymentRecord.payer_email
  ) {
    await params.supabase
      .from("payments")
      .update({
        payer_email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.id);
    paymentRecord.payer_email = normalizedEmail;
  }

  if (billingMode === "recurring") {
    if (!effectiveEmail) {
      throw new Error(
        "Mercado Pago recurring subscriptions require payer_email before checkout."
      );
    }

    const knownSubscriptionId =
      paymentRecord.mp_subscription_id ||
      (paymentRecord.schemaMode === "legacy" &&
      paymentRecord.mp_preference_id &&
      paymentRecord.mp_preference_id !== "pending"
        ? paymentRecord.mp_preference_id
        : null);

    if (knownSubscriptionId) {
      const subscription = await fetchMercadoPagoSubscription(
        knownSubscriptionId,
        params.accessToken
      );

      if (
        paymentRecord.schemaMode === "current" &&
        !paymentRecord.mp_subscription_status &&
        subscription.status
      ) {
        await params.supabase
          .from("payments")
          .update({
            mp_subscription_status: subscription.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRecord.id);
      }

      if (!subscription.init_point) {
        throw new Error("Subscription checkout link is not available.");
      }

      return {
        initPoint: subscription.init_point,
        paymentRecordId: paymentRecord.id,
        checkoutId: knownSubscriptionId,
        checkoutType: "subscription",
      };
    }

    return createRecurringCheckoutForRecord({
      supabase: params.supabase,
      paymentRecord,
      accessToken: params.accessToken,
      payerEmail: effectiveEmail,
    });
  }

  if (
    paymentRecord.mp_preference_id &&
    paymentRecord.mp_preference_id !== "pending"
  ) {
    const preference = await fetchMercadoPagoPreference(
      paymentRecord.mp_preference_id,
      params.accessToken
    );

    return {
      initPoint: preference.init_point,
      paymentRecordId: paymentRecord.id,
      checkoutId: paymentRecord.mp_preference_id,
      checkoutType: "preference",
    };
  }

  return createOneTimeCheckoutForRecord({
    supabase: params.supabase,
    paymentRecord,
    accessToken: params.accessToken,
    payerEmail: effectiveEmail,
  });
}

export async function createPaymentAndPreference(
  params: CreatePaymentParams
): Promise<{
  initPoint: string;
  paymentRecordId: string;
  checkoutId: string;
  checkoutType: "preference" | "subscription" | "email_capture";
}> {
  const billingMode = params.billingMode || "recurring";
  const paymentRecordId = await createPaymentRecord(params);

  if (
    billingMode === "recurring" &&
    !isValidMercadoPagoPayerEmail(params.payerEmail)
  ) {
    const token = createMercadoPagoStartToken({
      paymentRecordId,
      conversationId: params.conversationId,
      organizationId: params.organizationId,
    });

    if (!token) {
      throw new Error(
        "CRON_SECRET is required to create the Mercado Pago email capture link."
      );
    }

    return {
      initPoint: buildMercadoPagoStartUrl(token),
      paymentRecordId,
      checkoutId: paymentRecordId,
      checkoutType: "email_capture",
    };
  }

  return ensureMercadoPagoCheckoutForRecord({
    supabase: params.supabase,
    paymentRecordId,
    organizationId: params.organizationId,
    accessToken: params.accessToken,
    payerEmail: params.payerEmail,
  });
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
