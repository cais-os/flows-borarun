import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationSettings } from "@/lib/organization";
import { persistConversationMessage } from "@/lib/conversation-messages";
import {
  getMetaConfig,
  getMetaConfigFromSettings,
  sendMetaWhatsAppInteractiveListMessage,
  sendMetaWhatsAppTextMessage,
  type MetaConfig,
} from "@/lib/meta";
import { resolveAppOrigin } from "@/lib/strava";
import { getStripeClient } from "@/lib/stripe";

const PREMIUM_CONFIRMATION_PAYMENT_KEY = "_premium_confirmation_payment_id";
const AWAITING_WEEKLY_DAY_KEY = "_awaiting_weekly_day";

export type StripePaymentBillingMode = "one_time" | "recurring";

type PaymentRecordRow = {
  id: string;
  organization_id: string;
  conversation_id: string;
  plan_name: string | null;
  amount: number | string | null;
  duration_days: number | null;
  currency: string | null;
  status: string | null;
  billing_mode: StripePaymentBillingMode | null;
  payer_email: string | null;
  provider: string | null;
  provider_checkout_id: string | null;
  provider_customer_id: string | null;
  provider_payment_id: string | null;
  provider_subscription_id: string | null;
  provider_subscription_status: string | null;
  provider_invoice_id: string | null;
};

type ConversationRow = {
  id: string;
  contact_phone: string | null;
  flow_variables: Record<string, string> | null;
  subscription_renewed_count: number | null;
  subscription_status: string | null;
  subscription_plan: string | null;
};

export type ReconcileStripePaymentResult = {
  status: "approved" | "not_approved" | "ignored" | "not_found";
  source: "checkout_session" | "invoice" | "subscription";
  paymentRecordId?: string;
  conversationId?: string;
  providerPaymentId?: string | null;
  providerSubscriptionId?: string | null;
  paymentStatus?: string | null;
  alreadyProcessed?: boolean;
};

function stringifyStripeId(
  value:
    | string
    | { id?: string | null }
    | null
    | undefined
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

function getStripeInvoicePaymentIntentId(invoice: Stripe.Invoice) {
  return stringifyStripeId(
    (invoice as Stripe.Invoice & {
      payment_intent?: string | { id?: string | null } | null;
    }).payment_intent
  );
}

function toMinorUnits(amount: number) {
  const normalized = Number(amount) || 0;
  return Math.round(normalized * 100);
}

function normalizeBillingMode(
  value: StripePaymentBillingMode | null | undefined
): StripePaymentBillingMode {
  return value === "one_time" ? "one_time" : "recurring";
}

export function isValidStripeCustomerEmail(
  value: string | null | undefined
) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getStripeStatusPageUrl(params: {
  origin: string;
  organizationId: string;
  paymentRecordId: string;
  status: "success" | "failure";
}) {
  const url = new URL(`${params.origin}/stripe/status`);
  url.searchParams.set("org", params.organizationId);
  url.searchParams.set("payment_record_id", params.paymentRecordId);
  url.searchParams.set("s", params.status);
  if (params.status === "success") {
    url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }
  return url.toString();
}

async function createPaymentRecord(params: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  planName: string;
  amount: number;
  durationDays: number;
  currency: string;
  billingMode: StripePaymentBillingMode;
  payerEmail?: string | null;
}) {
  const { data, error } = await params.supabase
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
      billing_mode: params.billingMode,
      payer_email: params.payerEmail || null,
      provider: "stripe",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create payment record: ${error?.message || "unknown error"}`);
  }

  return data.id as string;
}

export async function loadStripePaymentRecord(params: {
  supabase: SupabaseClient;
  paymentRecordId: string;
}) {
  const { data, error } = await params.supabase
    .from("payments")
    .select(
      "id, organization_id, conversation_id, plan_name, amount, duration_days, currency, status, billing_mode, payer_email, provider, provider_checkout_id, provider_customer_id, provider_payment_id, provider_subscription_id, provider_subscription_status, provider_invoice_id"
    )
    .eq("id", params.paymentRecordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payment record: ${error.message}`);
  }

  return (data as PaymentRecordRow | null) || null;
}

async function findPaymentRecordByCheckoutId(params: {
  supabase: SupabaseClient;
  checkoutId: string;
}) {
  const { data, error } = await params.supabase
    .from("payments")
    .select(
      "id, organization_id, conversation_id, plan_name, amount, duration_days, currency, status, billing_mode, payer_email, provider, provider_checkout_id, provider_customer_id, provider_payment_id, provider_subscription_id, provider_subscription_status, provider_invoice_id"
    )
    .eq("provider_checkout_id", params.checkoutId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payment record by checkout: ${error.message}`);
  }

  return (data as PaymentRecordRow | null) || null;
}

async function findPaymentRecordBySubscriptionId(params: {
  supabase: SupabaseClient;
  subscriptionId: string;
}) {
  const { data, error } = await params.supabase
    .from("payments")
    .select(
      "id, organization_id, conversation_id, plan_name, amount, duration_days, currency, status, billing_mode, payer_email, provider, provider_checkout_id, provider_customer_id, provider_payment_id, provider_subscription_id, provider_subscription_status, provider_invoice_id"
    )
    .eq("provider_subscription_id", params.subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payment record by subscription: ${error.message}`);
  }

  return (data as PaymentRecordRow | null) || null;
}

async function persistConversationFlowVariables(params: {
  supabase: SupabaseClient;
  conversationId: string;
  flowVariables: Record<string, string>;
}) {
  await params.supabase
    .from("conversations")
    .update({
      flow_variables: params.flowVariables,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.conversationId);
}

async function sendWithMetaFallback<T>(params: {
  settings: OrganizationSettings | null;
  label: string;
  send: (config: MetaConfig) => Promise<T>;
}) {
  const primary = getMetaConfigFromSettings(params.settings);

  if (!primary.configured || !primary.config) {
    throw new Error("[payments] Meta not configured");
  }

  try {
    return await params.send(primary.config);
  } catch (error) {
    const fallback = getMetaConfig();
    const canRetryWithEnv =
      fallback.configured &&
      !!fallback.config &&
      (
        fallback.config.systemToken !== primary.config.systemToken ||
        fallback.config.phoneNumberId !== primary.config.phoneNumberId ||
        fallback.config.wabaId !== primary.config.wabaId
      );

    if (!canRetryWithEnv || !fallback.config) {
      throw error;
    }

    console.warn(
      `[payments] Failed to send ${params.label} with organization Meta config; retrying with env config`,
      error
    );

    return params.send(fallback.config);
  }
}

async function sendPostPaymentMessages(params: {
  supabase: SupabaseClient;
  conversation: ConversationRow;
  settings: OrganizationSettings | null;
  paymentId: string;
}) {
  if (!params.conversation.contact_phone) {
    return;
  }

  const { configured } = getMetaConfigFromSettings(params.settings);
  if (!configured) {
    console.warn("[payments] Meta not configured; skipping post-payment messages");
    return;
  }

  const flowVariables = {
    ...((params.conversation.flow_variables as Record<string, string> | null) || {}),
  };

  if (flowVariables[PREMIUM_CONFIRMATION_PAYMENT_KEY] !== params.paymentId) {
    const congratsMsg =
      "Parabens! Voce assinou o plano Premium com sucesso. A partir de agora esta liberado a conversar com a IA assessora de corrida!";
    const sent = await sendWithMetaFallback({
      settings: params.settings,
      label: "premium confirmation",
      send: (config) =>
        sendMetaWhatsAppTextMessage(
          {
            to: params.conversation.contact_phone!,
            body: congratsMsg,
          },
          config
        ),
    });

    try {
      await persistConversationMessage({
        supabase: params.supabase,
        conversationId: params.conversation.id,
        content: congratsMsg,
        type: "text",
        sender: "bot",
        waMessageId: sent.messageId,
      });
    } catch (error) {
      console.warn("[payments] Failed to persist premium confirmation message", error);
    }

    flowVariables[PREMIUM_CONFIRMATION_PAYMENT_KEY] = params.paymentId;
    await persistConversationFlowVariables({
      supabase: params.supabase,
      conversationId: params.conversation.id,
      flowVariables,
    });
  }

  if (flowVariables[AWAITING_WEEKLY_DAY_KEY] === "true") {
    return;
  }

  const dayMsg =
    "Vamos te enviar os treinos atualizados semanalmente de acordo com sua evolucao. Qual dia da semana prefere receber seus treinos?";
  const sent = await sendWithMetaFallback({
    settings: params.settings,
    label: "weekly day prompt",
    send: (config) =>
      sendMetaWhatsAppInteractiveListMessage(
        {
          to: params.conversation.contact_phone!,
          body: dayMsg,
          buttonText: "Escolher dia",
          sectionTitle: "Dias da semana",
          items: [
            { id: "day_1", title: "Segunda-feira" },
            { id: "day_2", title: "Terca-feira" },
            { id: "day_3", title: "Quarta-feira" },
            { id: "day_4", title: "Quinta-feira" },
            { id: "day_5", title: "Sexta-feira" },
            { id: "day_6", title: "Sabado" },
            { id: "day_0", title: "Domingo" },
          ],
        },
        config
      ),
  });

  try {
    await persistConversationMessage({
      supabase: params.supabase,
      conversationId: params.conversation.id,
      content: dayMsg,
      type: "interactive",
      sender: "bot",
      waMessageId: sent.messageId,
      metadata: {
        whatsapp_interactive_kind: "list",
        whatsapp_button_text: "Escolher dia",
      },
    });
  } catch (error) {
    console.warn("[payments] Failed to persist weekly day prompt message", error);
  }

  flowVariables[AWAITING_WEEKLY_DAY_KEY] = "true";
  await persistConversationFlowVariables({
    supabase: params.supabase,
    conversationId: params.conversation.id,
    flowVariables,
  });
}

function buildSessionMetadata(record: PaymentRecordRow) {
  return {
    paymentRecordId: record.id,
    conversationId: record.conversation_id,
    organizationId: record.organization_id,
    billingMode: normalizeBillingMode(record.billing_mode),
  };
}

async function createCheckoutSessionForRecord(params: {
  supabase: SupabaseClient;
  paymentRecord: PaymentRecordRow;
  payerEmail?: string | null;
}) {
  const stripe = getStripeClient();
  const origin = resolveAppOrigin();
  const billingMode = normalizeBillingMode(params.paymentRecord.billing_mode);
  const email = isValidStripeCustomerEmail(params.payerEmail)
    ? params.payerEmail!.trim()
    : isValidStripeCustomerEmail(params.paymentRecord.payer_email)
      ? params.paymentRecord.payer_email!.trim()
      : undefined;
  const metadata = buildSessionMetadata(params.paymentRecord);

  const lineItem =
    billingMode === "recurring"
      ? {
          price_data: {
            currency: (params.paymentRecord.currency || "BRL").toLowerCase(),
            recurring: {
              interval: "month" as const,
            },
            unit_amount: toMinorUnits(Number(params.paymentRecord.amount) || 0),
            product_data: {
              name: params.paymentRecord.plan_name || "Assinatura Premium",
            },
          },
          quantity: 1,
        }
      : {
          price_data: {
            currency: (params.paymentRecord.currency || "BRL").toLowerCase(),
            unit_amount: toMinorUnits(Number(params.paymentRecord.amount) || 0),
            product_data: {
              name: params.paymentRecord.plan_name || "Assinatura Premium",
            },
          },
          quantity: 1,
        };

  const session = await stripe.checkout.sessions.create({
    mode: billingMode === "recurring" ? "subscription" : "payment",
    billing_address_collection: "auto",
    allow_promotion_codes: false,
    locale: "pt-BR",
    client_reference_id: params.paymentRecord.id,
    customer_creation: billingMode === "one_time" ? "always" : undefined,
    customer_email: email,
    metadata,
    subscription_data:
      billingMode === "recurring"
        ? {
            metadata,
          }
        : undefined,
    line_items: [lineItem],
    success_url: getStripeStatusPageUrl({
      origin,
      organizationId: params.paymentRecord.organization_id,
      paymentRecordId: params.paymentRecord.id,
      status: "success",
    }),
    cancel_url: getStripeStatusPageUrl({
      origin,
      organizationId: params.paymentRecord.organization_id,
      paymentRecordId: params.paymentRecord.id,
      status: "failure",
    }),
  });

  await params.supabase
    .from("payments")
    .update({
      provider: "stripe",
      payer_email: email || params.paymentRecord.payer_email,
      provider_checkout_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.paymentRecord.id);

  return {
    checkoutId: session.id,
    initPoint: session.url,
    paymentRecordId: params.paymentRecord.id,
  };
}

async function updatePaymentRecordFromStripe(params: {
  supabase: SupabaseClient;
  paymentRecordId: string;
  values: Record<string, unknown>;
}) {
  await params.supabase
    .from("payments")
    .update({
      ...params.values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.paymentRecordId);
}

async function approvePaymentRecord(params: {
  supabase: SupabaseClient;
  settings: OrganizationSettings | null;
  paymentRecord: PaymentRecordRow;
  providerPaymentId: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  providerSubscriptionStatus: string | null;
  providerInvoiceId: string | null;
  payerEmail?: string | null;
  source: ReconcileStripePaymentResult["source"];
}) {
  const { data: conversation } = await params.supabase
    .from("conversations")
    .select(
      "id, contact_phone, flow_variables, subscription_renewed_count, subscription_status, subscription_plan"
    )
    .eq("id", params.paymentRecord.conversation_id)
    .single();

  const conversationRow = conversation as ConversationRow | null;
  if (!conversationRow) {
    return {
      status: "not_found",
      source: params.source,
      paymentRecordId: params.paymentRecord.id,
      conversationId: params.paymentRecord.conversation_id,
      providerPaymentId: params.providerPaymentId,
      providerSubscriptionId: params.providerSubscriptionId,
    } satisfies ReconcileStripePaymentResult;
  }

  const dedupeKey = params.providerInvoiceId || params.providerPaymentId;
  const currentKey =
    params.paymentRecord.provider_invoice_id || params.paymentRecord.provider_payment_id;
  const alreadyProcessed =
    params.paymentRecord.status === "approved" &&
    !!dedupeKey &&
    currentKey === dedupeKey;
  const needsConversationActivation =
    conversationRow.subscription_status !== "active" ||
    conversationRow.subscription_plan !== "premium";

  await updatePaymentRecordFromStripe({
    supabase: params.supabase,
    paymentRecordId: params.paymentRecord.id,
    values: {
      provider: "stripe",
      status: "approved",
      paid_at: new Date().toISOString(),
      payer_email: params.payerEmail || params.paymentRecord.payer_email,
      provider_customer_id:
        params.providerCustomerId || params.paymentRecord.provider_customer_id,
      provider_payment_id:
        params.providerPaymentId || params.paymentRecord.provider_payment_id,
      provider_subscription_id:
        params.providerSubscriptionId || params.paymentRecord.provider_subscription_id,
      provider_subscription_status:
        params.providerSubscriptionStatus || params.paymentRecord.provider_subscription_status,
      provider_invoice_id:
        params.providerInvoiceId || params.paymentRecord.provider_invoice_id,
    },
  });

  if (!alreadyProcessed || needsConversationActivation) {
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (Number(params.paymentRecord.duration_days) || 30)
    );

    await params.supabase
      .from("conversations")
      .update({
        subscription_status: "active",
        subscription_plan: "premium",
        subscription_started_at: new Date().toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        subscription_renewed_count:
          alreadyProcessed && !needsConversationActivation
            ? conversationRow.subscription_renewed_count || 0
            : (conversationRow.subscription_renewed_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.paymentRecord.conversation_id);
  }

  if (!alreadyProcessed && needsConversationActivation) {
    await sendPostPaymentMessages({
      supabase: params.supabase,
      conversation: conversationRow,
      settings: params.settings,
      paymentId:
        params.providerInvoiceId ||
        params.providerPaymentId ||
        params.providerSubscriptionId ||
        params.paymentRecord.id,
    });
  }

  return {
    status: "approved",
    source: params.source,
    paymentRecordId: params.paymentRecord.id,
    conversationId: params.paymentRecord.conversation_id,
    providerPaymentId: params.providerPaymentId,
    providerSubscriptionId: params.providerSubscriptionId,
    alreadyProcessed,
  } satisfies ReconcileStripePaymentResult;
}

function getPaymentRecordIdFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
) {
  const paymentRecordId = metadata?.paymentRecordId;
  return typeof paymentRecordId === "string" && paymentRecordId.trim()
    ? paymentRecordId.trim()
    : null;
}

async function resolveRecordFromCheckoutSession(params: {
  supabase: SupabaseClient;
  session: Stripe.Checkout.Session;
}) {
  const paymentRecordId =
    getPaymentRecordIdFromStripeMetadata(params.session.metadata) ||
    (typeof params.session.client_reference_id === "string"
      ? params.session.client_reference_id
      : null);

  if (paymentRecordId) {
    return loadStripePaymentRecord({
      supabase: params.supabase,
      paymentRecordId,
    });
  }

  return findPaymentRecordByCheckoutId({
    supabase: params.supabase,
    checkoutId: params.session.id,
  });
}

async function resolveRecordFromSubscription(params: {
  supabase: SupabaseClient;
  subscription: Stripe.Subscription;
}) {
  const metadataPaymentRecordId = getPaymentRecordIdFromStripeMetadata(
    params.subscription.metadata
  );

  if (metadataPaymentRecordId) {
    const record = await loadStripePaymentRecord({
      supabase: params.supabase,
      paymentRecordId: metadataPaymentRecordId,
    });
    if (record) return record;
  }

  return findPaymentRecordBySubscriptionId({
    supabase: params.supabase,
    subscriptionId: params.subscription.id,
  });
}

export async function createStripePaymentCheckout(params: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  planName: string;
  amount: number;
  durationDays: number;
  currency: string;
  billingMode?: StripePaymentBillingMode;
  payerEmail?: string | null;
}) {
  const paymentRecordId = await createPaymentRecord({
    supabase: params.supabase,
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    planName: params.planName,
    amount: params.amount,
    durationDays: params.durationDays,
    currency: params.currency,
    billingMode: normalizeBillingMode(params.billingMode),
    payerEmail: params.payerEmail,
  });

  const paymentRecord = await loadStripePaymentRecord({
    supabase: params.supabase,
    paymentRecordId,
  });

  if (!paymentRecord) {
    throw new Error("Payment record not found after creation");
  }

  const checkout = await createCheckoutSessionForRecord({
    supabase: params.supabase,
    paymentRecord,
    payerEmail: params.payerEmail,
  });

  return {
    ...checkout,
    checkoutType: normalizeBillingMode(params.billingMode),
  };
}

export async function ensureStripeCheckoutForRecord(params: {
  supabase: SupabaseClient;
  paymentRecordId: string;
  organizationId: string;
  payerEmail?: string | null;
}) {
  const paymentRecord = await loadStripePaymentRecord({
    supabase: params.supabase,
    paymentRecordId: params.paymentRecordId,
  });

  if (!paymentRecord || paymentRecord.organization_id !== params.organizationId) {
    throw new Error("Payment record not found");
  }

  return createCheckoutSessionForRecord({
    supabase: params.supabase,
    paymentRecord,
    payerEmail: params.payerEmail,
  });
}

export async function reconcileStripeCheckoutSession(params: {
  supabase: SupabaseClient;
  settings: OrganizationSettings | null;
  sessionId: string;
  organizationId?: string | null;
}) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(params.sessionId);
  const paymentRecord = await resolveRecordFromCheckoutSession({
    supabase: params.supabase,
    session,
  });

  if (!paymentRecord) {
    return {
      status: "not_found",
      source: "checkout_session",
    } satisfies ReconcileStripePaymentResult;
  }

  if (
    params.organizationId &&
    paymentRecord.organization_id !== params.organizationId
  ) {
    return {
      status: "ignored",
      source: "checkout_session",
      paymentRecordId: paymentRecord.id,
      conversationId: paymentRecord.conversation_id,
    } satisfies ReconcileStripePaymentResult;
  }

  const providerCustomerId = stringifyStripeId(session.customer);
  const providerPaymentId = stringifyStripeId(session.payment_intent);
  const providerSubscriptionId = stringifyStripeId(session.subscription);
  const providerInvoiceId = stringifyStripeId(session.invoice);
  const payerEmail = session.customer_details?.email || paymentRecord.payer_email;

  await updatePaymentRecordFromStripe({
    supabase: params.supabase,
    paymentRecordId: paymentRecord.id,
    values: {
      provider: "stripe",
      payer_email: payerEmail,
      provider_checkout_id: session.id,
      provider_customer_id:
        providerCustomerId || paymentRecord.provider_customer_id,
      provider_payment_id:
        providerPaymentId || paymentRecord.provider_payment_id,
      provider_subscription_id:
        providerSubscriptionId || paymentRecord.provider_subscription_id,
      provider_invoice_id:
        providerInvoiceId || paymentRecord.provider_invoice_id,
    },
  });

  if (session.payment_status !== "paid") {
    return {
      status: "not_approved",
      source: "checkout_session",
      paymentRecordId: paymentRecord.id,
      conversationId: paymentRecord.conversation_id,
      providerPaymentId,
      providerSubscriptionId,
      paymentStatus: session.payment_status,
    } satisfies ReconcileStripePaymentResult;
  }

  let providerSubscriptionStatus: string | null = null;
  if (providerSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(providerSubscriptionId);
    providerSubscriptionStatus = subscription.status;
  }

  return approvePaymentRecord({
    supabase: params.supabase,
    settings: params.settings,
    paymentRecord,
    providerPaymentId,
    providerCustomerId,
    providerSubscriptionId,
    providerSubscriptionStatus,
    providerInvoiceId,
    payerEmail,
    source: "checkout_session",
  });
}

export async function reconcileStripeInvoicePaid(params: {
  supabase: SupabaseClient;
  settings: OrganizationSettings | null;
  invoice: Stripe.Invoice;
}) {
  const stripe = getStripeClient();
  const subscriptionId = getStripeInvoiceSubscriptionId(params.invoice);
  if (!subscriptionId) {
    return {
      status: "ignored",
      source: "invoice",
    } satisfies ReconcileStripePaymentResult;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const paymentRecord = await resolveRecordFromSubscription({
    supabase: params.supabase,
    subscription,
  });

  if (!paymentRecord) {
    return {
      status: "not_found",
      source: "invoice",
      providerSubscriptionId: subscriptionId,
    } satisfies ReconcileStripePaymentResult;
  }

  return approvePaymentRecord({
    supabase: params.supabase,
    settings: params.settings,
    paymentRecord,
    providerPaymentId: getStripeInvoicePaymentIntentId(params.invoice),
    providerCustomerId:
      stringifyStripeId(params.invoice.customer) ||
      stringifyStripeId(subscription.customer),
    providerSubscriptionId: subscription.id,
    providerSubscriptionStatus: subscription.status,
    providerInvoiceId: params.invoice.id,
    payerEmail: params.invoice.customer_email || paymentRecord.payer_email,
    source: "invoice",
  });
}

export async function reconcileStripeSubscriptionChange(params: {
  supabase: SupabaseClient;
  subscription: Stripe.Subscription;
}) {
  const paymentRecord = await resolveRecordFromSubscription({
    supabase: params.supabase,
    subscription: params.subscription,
  });

  if (!paymentRecord) {
    return {
      status: "not_found",
      source: "subscription",
      providerSubscriptionId: params.subscription.id,
    } satisfies ReconcileStripePaymentResult;
  }

  await updatePaymentRecordFromStripe({
    supabase: params.supabase,
    paymentRecordId: paymentRecord.id,
    values: {
      provider: "stripe",
      provider_customer_id:
        stringifyStripeId(params.subscription.customer) ||
        paymentRecord.provider_customer_id,
      provider_subscription_id: params.subscription.id,
      provider_subscription_status:
        params.subscription.cancel_at_period_end ||
        params.subscription.status === "canceled"
          ? "cancelled"
          : params.subscription.status,
    },
  });

  if (
    params.subscription.cancel_at_period_end ||
    params.subscription.status === "canceled"
  ) {
    await params.supabase
      .from("conversations")
      .update({
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.conversation_id)
      .eq("organization_id", paymentRecord.organization_id);
  }

  return {
    status: "ignored",
    source: "subscription",
    paymentRecordId: paymentRecord.id,
    conversationId: paymentRecord.conversation_id,
    providerSubscriptionId: params.subscription.id,
    paymentStatus: params.subscription.status,
  } satisfies ReconcileStripePaymentResult;
}

export async function createStripeWebhookEvent(params: {
  payload: string;
  signature: string;
  webhookSecret: string;
}) {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    params.payload,
    params.signature,
    params.webhookSecret
  );
}

export async function cancelStripeSubscriptionAtPeriodEnd(
  subscriptionId: string
) {
  const stripe = getStripeClient();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
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
