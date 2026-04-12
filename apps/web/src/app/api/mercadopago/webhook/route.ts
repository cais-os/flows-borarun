import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  extractMercadoPagoPaymentNotification,
  getMercadoPagoConfig,
  type MercadoPagoNotificationPayload,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercado-pago";
import { reconcileMercadoPagoPayment } from "@/lib/mercado-pago-reconciliation";

function parseLegacyMercadoPagoBody(rawBody: string): MercadoPagoNotificationPayload {
  const formData = new URLSearchParams(rawBody);

  return {
    action: formData.get("action") || undefined,
    topic: formData.get("topic") || undefined,
    type: formData.get("type") || undefined,
    id: formData.get("id") || undefined,
    resource: formData.get("resource") || undefined,
    data: formData.get("data.id")
      ? {
          id: formData.get("data.id") || undefined,
        }
      : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org");
    const rawBody = await request.text();

    let body: MercadoPagoNotificationPayload = {};
    if (rawBody.trim().length > 0) {
      try {
        body = JSON.parse(rawBody) as MercadoPagoNotificationPayload;
      } catch {
        body = parseLegacyMercadoPagoBody(rawBody);
      }
    }

    const notification = extractMercadoPagoPaymentNotification({
      body,
      requestUrl: request.url,
    });

    console.log("[MP Webhook] Received:", {
      notificationType: notification.notificationType,
      paymentId: notification.paymentId,
      action: body.action || null,
    });

    if (!notification.isPaymentNotification || !notification.paymentId) {
      return NextResponse.json({ ok: true });
    }

    if (!orgId) {
      console.error("[MP Webhook] Missing org query param");
      return NextResponse.json({ ok: true });
    }

    const settings = await getOrganizationSettingsById(orgId);
    const mpConfig = getMercadoPagoConfig(settings);

    if (!mpConfig.configured || !mpConfig.config) {
      console.error("[MP Webhook] MP not configured for org", orgId);
      return NextResponse.json({ ok: true });
    }

    const hasSignatureHeaders =
      Boolean(request.headers.get("x-signature")) ||
      Boolean(request.headers.get("x-request-id"));
    const mustVerifySignature =
      notification.isSignedWebhookShape || hasSignatureHeaders;

    if (mustVerifySignature) {
      if (!mpConfig.config.webhookSecret) {
        console.error("[MP Webhook] Missing webhook secret for org", orgId);
        return NextResponse.json(
          { ok: false, error: "Webhook secret not configured" },
          { status: 503 }
        );
      }

      const signatureVerified = verifyMercadoPagoWebhookSignature({
        body,
        requestIdHeader: request.headers.get("x-request-id"),
        requestUrl: request.url,
        secret: mpConfig.config.webhookSecret,
        signatureHeader: request.headers.get("x-signature"),
      });

      if (!signatureVerified) {
        console.error("[MP Webhook] Invalid signature", {
          orgId,
          paymentId: notification.paymentId,
        });
        return NextResponse.json(
          { ok: false, error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    const supabase = createServerClient();
    const result = await reconcileMercadoPagoPayment({
      supabase,
      organizationId: orgId,
      settings,
      paymentId: notification.paymentId,
      source: "payment",
    });

    console.log("[MP Webhook] Reconciled payment", {
      orgId,
      paymentId: notification.paymentId,
      result,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}
