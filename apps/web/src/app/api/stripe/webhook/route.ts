import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  createStripeWebhookEvent,
  reconcileStripeCheckoutSession,
  reconcileStripeInvoicePaid,
  reconcileStripeSubscriptionChange,
} from "@/lib/stripe-payments";
import { getStripeClient, getStripeConfig } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";

function getMetadataOrganizationId(metadata: Stripe.Metadata | null | undefined) {
  const organizationId = metadata?.organizationId;
  return typeof organizationId === "string" && organizationId.trim()
    ? organizationId.trim()
    : null;
}

function stringifyStripeId(
  value: string | { id?: string | null } | null | undefined
) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return typeof value.id === "string" ? value.id : null;
}

function getStripeInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  return stringifyStripeId(
    (invoice as Stripe.Invoice & {
      subscription?: string | { id?: string | null } | null;
    }).subscription
  );
}

export async function POST(request: Request) {
  const stripeConfig = getStripeConfig();
  if (!stripeConfig.configured || !stripeConfig.config?.webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Stripe webhook secret nao configurado." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  try {
    const payload = await request.text();
    const event = await createStripeWebhookEvent({
      payload,
      signature,
      webhookSecret: stripeConfig.config.webhookSecret,
    });

    const supabase = createServerClient();
    let result: unknown = null;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = getMetadataOrganizationId(session.metadata);
        const settings = organizationId
          ? await getOrganizationSettingsById(organizationId)
          : null;

        result = await reconcileStripeCheckoutSession({
          supabase,
          settings,
          sessionId: session.id,
          organizationId,
        });
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getStripeInvoiceSubscriptionId(invoice);
        let settings = null;

        if (subscriptionId) {
          const stripe = getStripeClient();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const organizationId = getMetadataOrganizationId(subscription.metadata);
          settings = organizationId
            ? await getOrganizationSettingsById(organizationId)
            : null;
        }

        result = await reconcileStripeInvoicePaid({
          supabase,
          settings,
          invoice,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        result = await reconcileStripeSubscriptionChange({
          supabase,
          subscription,
        });
        break;
      }
      default:
        result = { ignored: true, type: event.type };
        break;
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[stripe/webhook] failed", error);
    return NextResponse.json(
      { ok: false, error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
