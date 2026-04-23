import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCronSecret } from "@/lib/internal-auth";
import { resolveAppOrigin } from "@/lib/strava";

export type SubscriptionCancellationTokenPayload = {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
  subscriptionId: string;
  paymentProvider?: string | null;
  exp: number;
};

export type CancellableSubscriptionRecord = {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
  subscriptionId: string;
  paymentProvider: string | null;
  subscriptionStatus: string | null;
  planName: string | null;
  expiresAt: string | null;
};

const DEFAULT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeCompareText(expected: string, received: string) {
  if (expected.length !== received.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(received, "utf8")
    );
  } catch {
    return false;
  }
}

export function hasConversationSubscriptionAccess(
  status: string | null | undefined,
  expiresAt: string | null | undefined
) {
  if (!expiresAt) return false;

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime()) || expires <= new Date()) {
    return false;
  }

  return (
    status === "active" ||
    status === "trial" ||
    status === "cancelled"
  );
}

export function detectSubscriptionCancellationIntent(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const cancelWords =
    /\b(cancelar|cancelamento|cancel|descadastrar|desativar|encerrar|parar|nao quero mais|nao quero continuar)\b/;
  const subscriptionWords =
    /\b(assinatura|premium|plano|cobranca|pagamento|renovacao|mensalidade)\b/;

  return cancelWords.test(normalized) && subscriptionWords.test(normalized);
}

export function createSubscriptionCancellationToken(params: {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
  subscriptionId: string;
  paymentProvider?: string | null;
  expiresInMs?: number;
}) {
  const secret = getCronSecret();
  if (!secret) return null;

  const payload: SubscriptionCancellationTokenPayload = {
    paymentRecordId: params.paymentRecordId,
    conversationId: params.conversationId,
    organizationId: params.organizationId,
    subscriptionId: params.subscriptionId,
    paymentProvider: params.paymentProvider || null,
    exp: Date.now() + (params.expiresInMs ?? DEFAULT_TOKEN_TTL_MS),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySubscriptionCancellationToken(token: string | null | undefined) {
  const secret = getCronSecret();
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".", 2);
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeCompareText(expectedSignature, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload)
    ) as SubscriptionCancellationTokenPayload;

    if (
      typeof payload.paymentRecordId !== "string" ||
      typeof payload.conversationId !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.subscriptionId !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildSubscriptionCancellationUrl(token: string) {
  const origin = resolveAppOrigin();
  const url = new URL(`${origin}/subscription/cancel`);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function findCancellableSubscriptionForConversation(params: {
  supabase: SupabaseClient;
  conversationId: string;
  organizationId: string;
}) {
  const { data: conversation } = await params.supabase
    .from("conversations")
    .select("id, organization_id, subscription_status, subscription_expires_at")
    .eq("id", params.conversationId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  const conv = conversation as {
    id: string;
    organization_id: string;
    subscription_status: string | null;
    subscription_expires_at: string | null;
  } | null;

  if (
    !conv ||
    !hasConversationSubscriptionAccess(
      conv.subscription_status,
      conv.subscription_expires_at
    )
  ) {
    return null;
  }

  const { data: payment } = await params.supabase
    .from("payments")
    .select(
      "id, organization_id, conversation_id, provider, provider_subscription_id, provider_subscription_status, mp_subscription_id, mp_subscription_status, billing_mode, plan_name"
    )
    .eq("organization_id", params.organizationId)
    .eq("conversation_id", params.conversationId)
    .eq("billing_mode", "recurring")
    .or("provider_subscription_id.not.is.null,mp_subscription_id.not.is.null")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const record = payment as {
    id: string;
    organization_id: string;
    conversation_id: string;
    provider: string | null;
    provider_subscription_id: string | null;
    provider_subscription_status: string | null;
    mp_subscription_id: string | null;
    mp_subscription_status: string | null;
    plan_name: string | null;
  } | null;

  const subscriptionId =
    record?.provider_subscription_id || record?.mp_subscription_id || null;

  if (!record || !subscriptionId) {
    return null;
  }

  return {
    paymentRecordId: record.id,
    conversationId: record.conversation_id,
    organizationId: record.organization_id,
    subscriptionId,
    paymentProvider:
      record.provider ||
      (record.provider_subscription_id ? "stripe" : "mercado_pago"),
    subscriptionStatus:
      record.provider_subscription_status || record.mp_subscription_status,
    planName: record.plan_name,
    expiresAt: conv.subscription_expires_at,
  } satisfies CancellableSubscriptionRecord;
}

export function formatSubscriptionValidity(date: string | null | undefined) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("pt-BR");
}
