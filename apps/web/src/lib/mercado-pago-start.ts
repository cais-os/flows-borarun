import { createHmac, timingSafeEqual } from "crypto";
import { getCronSecret } from "@/lib/internal-auth";
import { resolveAppOrigin } from "@/lib/strava";

export type MercadoPagoStartTokenPayload = {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
  exp: number;
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
  const padding =
    normalized.length % 4 === 0
      ? ""
      : "=".repeat(4 - (normalized.length % 4));
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

export function createMercadoPagoStartToken(params: {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
  expiresInMs?: number;
}) {
  const secret = getCronSecret();
  if (!secret) return null;

  const payload: MercadoPagoStartTokenPayload = {
    paymentRecordId: params.paymentRecordId,
    conversationId: params.conversationId,
    organizationId: params.organizationId,
    exp: Date.now() + (params.expiresInMs ?? DEFAULT_TOKEN_TTL_MS),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyMercadoPagoStartToken(token: string | null | undefined) {
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
    ) as MercadoPagoStartTokenPayload;

    if (
      typeof payload.paymentRecordId !== "string" ||
      typeof payload.conversationId !== "string" ||
      typeof payload.organizationId !== "string" ||
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

export function buildMercadoPagoStartUrl(token: string) {
  const origin = resolveAppOrigin();
  const url = new URL(`${origin}/mercadopago/start`);
  url.searchParams.set("token", token);
  return url.toString();
}
