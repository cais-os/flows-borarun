import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationSettings } from "@/lib/organization";
import {
  fetchMercadoPagoAuthorizedPayment,
  fetchMercadoPagoPayment,
  fetchMercadoPagoPreference,
  fetchMercadoPagoSubscription,
  getMercadoPagoConfig,
  loadMercadoPagoPaymentRecord,
  searchMercadoPagoPaymentsByExternalReference,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoBillingMode,
  type MercadoPagoPayment,
  type MercadoPagoSubscription,
} from "@/lib/mercado-pago";
import {
  getMetaConfig,
  getMetaConfigFromSettings,
  sendMetaWhatsAppInteractiveListMessage,
  sendMetaWhatsAppTextMessage,
  type MetaConfig,
} from "@/lib/meta";

const PREMIUM_CONFIRMATION_PAYMENT_KEY = "_premium_confirmation_payment_id";
const AWAITING_WEEKLY_DAY_KEY = "_awaiting_weekly_day";

type PaymentReference = {
  paymentRecordId: string;
  conversationId: string;
  organizationId: string;
};

type PaymentRecordRow = {
  id: string;
  organization_id: string;
  conversation_id: string;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  mp_subscription_id: string | null;
  mp_subscription_status: string | null;
  mp_authorized_payment_id: string | null;
  billing_mode: MercadoPagoBillingMode | null;
  payer_email: string | null;
  plan_name: string | null;
  duration_days: number | null;
  schemaMode?: "current" | "legacy";
};

type ConversationRow = {
  id: string;
  contact_phone: string | null;
  flow_variables: Record<string, string> | null;
  subscription_renewed_count: number | null;
  subscription_status: string | null;
  subscription_plan: string | null;
};

export type ReconcileMercadoPagoPaymentResult = {
  status: "approved" | "not_approved" | "ignored" | "not_found";
  source:
    | "payment"
    | "preference"
    | "subscription"
    | "authorized_payment"
    | "external_reference"
    | "pending";
  paymentRecordId?: string;
  conversationId?: string;
  mpPaymentId?: string;
  paymentStatus?: string;
  alreadyProcessed?: boolean;
};

function parsePaymentReference(raw: string | null | undefined): PaymentReference | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PaymentReference>;
    if (
      typeof parsed.paymentRecordId !== "string" ||
      typeof parsed.conversationId !== "string" ||
      typeof parsed.organizationId !== "string"
    ) {
      return null;
    }

    return {
      paymentRecordId: parsed.paymentRecordId,
      conversationId: parsed.conversationId,
      organizationId: parsed.organizationId,
    };
  } catch {
    return null;
  }
}

function buildPaymentReference(record: {
  id: string;
  conversation_id: string;
  organization_id: string;
}) {
  return JSON.stringify({
    paymentRecordId: record.id,
    conversationId: record.conversation_id,
    organizationId: record.organization_id,
  });
}

function pickBestMercadoPagoPayment(
  payments: MercadoPagoPayment[]
): MercadoPagoPayment | null {
  if (payments.length === 0) return null;

  return (
    payments.find((payment) => payment.status === "approved") ||
    payments.find((payment) => payment.status === "in_process") ||
    payments.find((payment) => payment.status === "pending") ||
    payments[0]
  );
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
    throw new Error("[mercado-pago] Meta not configured");
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
      `[mercado-pago] Failed to send ${params.label} with organization Meta config; retrying with env config`,
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
    console.warn("[mercado-pago] Meta not configured; skipping post-payment messages");
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

    await params.supabase.from("messages").insert({
      conversation_id: params.conversation.id,
      content: congratsMsg,
      type: "text",
      sender: "bot",
      wa_message_id: sent.messageId,
    });

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

  await params.supabase.from("messages").insert({
    conversation_id: params.conversation.id,
    content: dayMsg,
    type: "interactive",
    sender: "bot",
    wa_message_id: sent.messageId,
  });

  flowVariables[AWAITING_WEEKLY_DAY_KEY] = "true";
  await persistConversationFlowVariables({
    supabase: params.supabase,
    conversationId: params.conversation.id,
    flowVariables,
  });
}

async function updatePaymentRecordStatus(params: {
  supabase: SupabaseClient;
  paymentRecord: PaymentRecordRow;
  paymentRecordId: string;
  mpPayment: MercadoPagoPayment;
  mpAuthorizedPaymentId?: string | null;
  mpSubscriptionId?: string | null;
  mpSubscriptionStatus?: string | null;
}) {
  const baseUpdate = {
    mp_payment_id: String(params.mpPayment.id),
    status: params.mpPayment.status,
    paid_at: params.mpPayment.date_approved || null,
    updated_at: new Date().toISOString(),
  };

  const extendedUpdate =
    params.paymentRecord.schemaMode === "current"
      ? {
          ...baseUpdate,
          mp_authorized_payment_id: params.mpAuthorizedPaymentId || null,
          mp_subscription_id: params.mpSubscriptionId || undefined,
          mp_subscription_status: params.mpSubscriptionStatus || undefined,
          payer_email: params.mpPayment.payer?.email || undefined,
        }
      : baseUpdate;

  await params.supabase
    .from("payments")
    .update(extendedUpdate)
    .eq("id", params.paymentRecordId);
}

async function syncPaymentRecordSubscription(params: {
  supabase: SupabaseClient;
  paymentRecord: PaymentRecordRow;
  paymentRecordId: string;
  subscription: MercadoPagoSubscription;
}) {
  const update =
    params.paymentRecord.schemaMode === "current"
      ? {
          mp_subscription_id: params.subscription.id,
          mp_subscription_status: params.subscription.status || null,
          payer_email: params.subscription.payer_email || undefined,
          updated_at: new Date().toISOString(),
        }
      : {
          mp_preference_id: params.subscription.id,
          updated_at: new Date().toISOString(),
        };

  await params.supabase
    .from("payments")
    .update(update)
    .eq("id", params.paymentRecordId);
}

function getAuthorizedPaymentLinkedPaymentId(
  authorizedPayment: MercadoPagoAuthorizedPayment
) {
  const directPaymentId = authorizedPayment.payment?.id;
  if (directPaymentId !== undefined && directPaymentId !== null) {
    return String(directPaymentId);
  }

  return null;
}

export async function reconcileMercadoPagoPayment(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  paymentId: string;
  source?: ReconcileMercadoPagoPaymentResult["source"];
  authorizedPaymentId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
}): Promise<ReconcileMercadoPagoPaymentResult> {
  const mpConfig = getMercadoPagoConfig(params.settings);
  if (!mpConfig.configured || !mpConfig.config) {
    throw new Error(
      `[mercado-pago] organization ${params.organizationId} is not configured`
    );
  }

  const mpPayment = await fetchMercadoPagoPayment(
    params.paymentId,
    mpConfig.config.accessToken
  );
  const paymentRef = parsePaymentReference(mpPayment.external_reference);
  if (!paymentRef) {
    return {
      status: "ignored",
      source: params.source || "payment",
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
    };
  }

  if (paymentRef.organizationId !== params.organizationId) {
    return {
      status: "ignored",
      source: params.source || "payment",
      paymentRecordId: paymentRef.paymentRecordId,
      conversationId: paymentRef.conversationId,
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
    };
  }

  const paymentRecord = await loadMercadoPagoPaymentRecord({
    supabase: params.supabase,
    paymentRecordId: paymentRef.paymentRecordId,
  });

  if (!paymentRecord) {
    return {
      status: "not_found",
      source: params.source || "payment",
      paymentRecordId: paymentRef.paymentRecordId,
      conversationId: paymentRef.conversationId,
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
    };
  }

  const record = paymentRecord as PaymentRecordRow;
  if (
    record.organization_id !== params.organizationId ||
    record.conversation_id !== paymentRef.conversationId
  ) {
    return {
      status: "ignored",
      source: params.source || "payment",
      paymentRecordId: record.id,
      conversationId: record.conversation_id,
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
    };
  }

  if (
    Number(record.amount) !== Number(mpPayment.transaction_amount) ||
    record.currency !== mpPayment.currency_id
  ) {
    return {
      status: "ignored",
      source: params.source || "payment",
      paymentRecordId: record.id,
      conversationId: record.conversation_id,
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
    };
  }

  const { data: conversation } = await params.supabase
    .from("conversations")
    .select(
      "id, contact_phone, flow_variables, subscription_renewed_count, subscription_status, subscription_plan"
    )
    .eq("id", record.conversation_id)
    .single();

  const conversationRow = conversation as ConversationRow | null;
  if (!conversationRow) {
    return {
      status: "not_found",
      source: params.source || "payment",
      paymentRecordId: record.id,
      conversationId: record.conversation_id,
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
    };
  }

  const alreadyProcessed =
    record.status === "approved" && record.mp_payment_id === String(mpPayment.id);
  const needsConversationActivation =
    conversationRow.subscription_status !== "active" ||
    conversationRow.subscription_plan !== "premium";

  if (mpPayment.status !== "approved") {
    await updatePaymentRecordStatus({
      supabase: params.supabase,
      paymentRecord: record,
      paymentRecordId: record.id,
      mpPayment,
      mpAuthorizedPaymentId: params.authorizedPaymentId,
      mpSubscriptionId: params.subscriptionId || record.mp_subscription_id,
      mpSubscriptionStatus:
        params.subscriptionStatus || record.mp_subscription_status,
    });

    return {
      status: "not_approved",
      source: params.source || "payment",
      paymentRecordId: record.id,
      conversationId: record.conversation_id,
      mpPaymentId: String(mpPayment.id),
      paymentStatus: mpPayment.status,
      alreadyProcessed,
    };
  }

  if (!alreadyProcessed || needsConversationActivation) {
    await updatePaymentRecordStatus({
      supabase: params.supabase,
      paymentRecord: record,
      paymentRecordId: record.id,
      mpPayment,
      mpAuthorizedPaymentId: params.authorizedPaymentId,
      mpSubscriptionId: params.subscriptionId || record.mp_subscription_id,
      mpSubscriptionStatus:
        params.subscriptionStatus || record.mp_subscription_status,
    });

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (Number(record.duration_days) || 30)
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
      .eq("id", record.conversation_id);
  }

  await sendPostPaymentMessages({
    supabase: params.supabase,
    conversation: conversationRow,
    settings: params.settings,
    paymentId: String(mpPayment.id),
  });

  return {
    status: "approved",
    source: params.source || "payment",
    paymentRecordId: record.id,
    conversationId: record.conversation_id,
    mpPaymentId: String(mpPayment.id),
    paymentStatus: mpPayment.status,
    alreadyProcessed,
  };
}

export async function reconcileMercadoPagoSubscriptionById(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  subscriptionId: string;
  source?: ReconcileMercadoPagoPaymentResult["source"];
}): Promise<ReconcileMercadoPagoPaymentResult> {
  const mpConfig = getMercadoPagoConfig(params.settings);
  if (!mpConfig.configured || !mpConfig.config) {
    throw new Error(
      `[mercado-pago] organization ${params.organizationId} is not configured`
    );
  }

  const subscription = await fetchMercadoPagoSubscription(
    params.subscriptionId,
    mpConfig.config.accessToken
  );
  const paymentRef = parsePaymentReference(subscription.external_reference);

  if (!paymentRef) {
    return {
      status: "ignored",
      source: params.source || "subscription",
    };
  }

  if (paymentRef.organizationId !== params.organizationId) {
    return {
      status: "ignored",
      source: params.source || "subscription",
      paymentRecordId: paymentRef.paymentRecordId,
      conversationId: paymentRef.conversationId,
    };
  }

  const paymentRecord = await loadMercadoPagoPaymentRecord({
    supabase: params.supabase,
    paymentRecordId: paymentRef.paymentRecordId,
  });

  await syncPaymentRecordSubscription({
    supabase: params.supabase,
    paymentRecord:
      paymentRecord ||
      ({
        id: paymentRef.paymentRecordId,
        organization_id: paymentRef.organizationId,
        conversation_id: paymentRef.conversationId,
        amount: 0,
        currency: "BRL",
        status: null,
        mp_payment_id: null,
        mp_preference_id: params.subscriptionId,
        mp_subscription_id: params.subscriptionId,
        mp_subscription_status: null,
        mp_authorized_payment_id: null,
        billing_mode: null,
        payer_email: null,
        plan_name: null,
        duration_days: null,
        schemaMode: "legacy",
      } satisfies PaymentRecordRow),
    paymentRecordId: paymentRef.paymentRecordId,
    subscription,
  });

  if (subscription.status === "cancelled") {
    await params.supabase
      .from("conversations")
      .update({
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRef.conversationId)
      .eq("organization_id", params.organizationId);

    return {
      status: "ignored",
      source: params.source || "subscription",
      paymentRecordId: paymentRef.paymentRecordId,
      conversationId: paymentRef.conversationId,
    };
  }

  return reconcileMercadoPagoPaymentByExternalReference({
    supabase: params.supabase,
    organizationId: params.organizationId,
    settings: params.settings,
    externalReference:
      subscription.external_reference ||
      JSON.stringify({
        paymentRecordId: paymentRef.paymentRecordId,
        conversationId: paymentRef.conversationId,
        organizationId: paymentRef.organizationId,
      }),
    source: params.source || "subscription",
  });
}

export async function reconcileMercadoPagoAuthorizedPayment(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  authorizedPaymentId: string;
}): Promise<ReconcileMercadoPagoPaymentResult> {
  const mpConfig = getMercadoPagoConfig(params.settings);
  if (!mpConfig.configured || !mpConfig.config) {
    throw new Error(
      `[mercado-pago] organization ${params.organizationId} is not configured`
    );
  }

  const authorizedPayment = await fetchMercadoPagoAuthorizedPayment(
    params.authorizedPaymentId,
    mpConfig.config.accessToken
  );

  const linkedPaymentId =
    getAuthorizedPaymentLinkedPaymentId(authorizedPayment);

  if (linkedPaymentId) {
    return reconcileMercadoPagoPayment({
      supabase: params.supabase,
      organizationId: params.organizationId,
      settings: params.settings,
      paymentId: linkedPaymentId,
      source: "authorized_payment",
      authorizedPaymentId: params.authorizedPaymentId,
      subscriptionId: authorizedPayment.preapproval_id || null,
    });
  }

  if (authorizedPayment.preapproval_id) {
    return reconcileMercadoPagoSubscriptionById({
      supabase: params.supabase,
      organizationId: params.organizationId,
      settings: params.settings,
      subscriptionId: authorizedPayment.preapproval_id,
      source: "authorized_payment",
    });
  }

  return {
    status: "not_found",
    source: "authorized_payment",
  };
}

export async function reconcileMercadoPagoPaymentByExternalReference(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  externalReference: string;
  source?: ReconcileMercadoPagoPaymentResult["source"];
}): Promise<ReconcileMercadoPagoPaymentResult> {
  const mpConfig = getMercadoPagoConfig(params.settings);
  if (!mpConfig.configured || !mpConfig.config) {
    throw new Error(
      `[mercado-pago] organization ${params.organizationId} is not configured`
    );
  }

  const matches = await searchMercadoPagoPaymentsByExternalReference(
    params.externalReference,
    mpConfig.config.accessToken
  );
  const payment = pickBestMercadoPagoPayment(matches);

  if (!payment) {
    return {
      status: "not_found",
      source: params.source || "external_reference",
    };
  }

  return reconcileMercadoPagoPayment({
    supabase: params.supabase,
    organizationId: params.organizationId,
    settings: params.settings,
    paymentId: String(payment.id),
    source: params.source || "external_reference",
  });
}

export async function reconcileMercadoPagoPaymentByPreferenceId(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  preferenceId: string;
}): Promise<ReconcileMercadoPagoPaymentResult> {
  const mpConfig = getMercadoPagoConfig(params.settings);
  if (!mpConfig.configured || !mpConfig.config) {
    throw new Error(
      `[mercado-pago] organization ${params.organizationId} is not configured`
    );
  }

  const preference = await fetchMercadoPagoPreference(
    params.preferenceId,
    mpConfig.config.accessToken
  );

  if (!preference.external_reference) {
    return {
      status: "not_found",
      source: "preference",
    };
  }

  return reconcileMercadoPagoPaymentByExternalReference({
    supabase: params.supabase,
    organizationId: params.organizationId,
    settings: params.settings,
    externalReference: preference.external_reference,
    source: "preference",
  });
}

export async function reconcileMercadoPagoPaymentRecord(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  paymentRecordId: string;
}): Promise<ReconcileMercadoPagoPaymentResult> {
  const paymentRecord = await loadMercadoPagoPaymentRecord({
    supabase: params.supabase,
    paymentRecordId: params.paymentRecordId,
  });

  if (!paymentRecord) {
    return {
      status: "not_found",
      source: "pending",
      paymentRecordId: params.paymentRecordId,
    };
  }

  const record = paymentRecord as PaymentRecordRow;

  if (record.organization_id !== params.organizationId) {
    return {
      status: "ignored",
      source: "pending",
      paymentRecordId: record.id,
      conversationId: record.conversation_id,
    };
  }

  if (record.mp_payment_id) {
    return reconcileMercadoPagoPayment({
      supabase: params.supabase,
      organizationId: params.organizationId,
      settings: params.settings,
      paymentId: record.mp_payment_id,
      source: "pending",
    });
  }

  if (record.billing_mode === "recurring" && record.mp_subscription_id) {
    return reconcileMercadoPagoSubscriptionById({
      supabase: params.supabase,
      organizationId: params.organizationId,
      settings: params.settings,
      subscriptionId: record.mp_subscription_id,
      source: "pending",
    });
  }

  if (record.mp_preference_id && record.mp_preference_id !== "pending") {
    if (record.billing_mode === "one_time") {
      return reconcileMercadoPagoPaymentByPreferenceId({
        supabase: params.supabase,
        organizationId: params.organizationId,
        settings: params.settings,
        preferenceId: record.mp_preference_id,
      });
    }

    try {
      return reconcileMercadoPagoPaymentByPreferenceId({
        supabase: params.supabase,
        organizationId: params.organizationId,
        settings: params.settings,
        preferenceId: record.mp_preference_id,
      });
    } catch {
      return reconcileMercadoPagoSubscriptionById({
        supabase: params.supabase,
        organizationId: params.organizationId,
        settings: params.settings,
        subscriptionId: record.mp_preference_id,
        source: "pending",
      });
    }
  }

  return reconcileMercadoPagoPaymentByExternalReference({
    supabase: params.supabase,
    organizationId: params.organizationId,
    settings: params.settings,
    externalReference: buildPaymentReference(record),
    source: "pending",
  });
}

export async function reconcilePendingMercadoPagoPayments(params: {
  supabase: SupabaseClient;
  organizationId: string;
  settings: OrganizationSettings | null;
  limit?: number;
}): Promise<ReconcileMercadoPagoPaymentResult[]> {
  const { data: payments } = await params.supabase
    .from("payments")
    .select("id")
    .eq("organization_id", params.organizationId)
    .in("status", ["pending", "in_process"])
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 20);

  const results: ReconcileMercadoPagoPaymentResult[] = [];
  for (const payment of payments || []) {
    const result = await reconcileMercadoPagoPaymentRecord({
      supabase: params.supabase,
      organizationId: params.organizationId,
      settings: params.settings,
      paymentRecordId: payment.id as string,
    });
    results.push(result);
  }

  return results;
}
