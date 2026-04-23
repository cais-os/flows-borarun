import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  cancelMercadoPagoSubscription,
  getMercadoPagoConfig,
} from "@/lib/mercado-pago";
import { cancelStripeSubscriptionAtPeriodEnd } from "@/lib/stripe-payments";
import { verifySubscriptionCancellationToken } from "@/lib/subscription-utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const payload = verifySubscriptionCancellationToken(body.token);

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "Link de cancelamento invalido ou expirado." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: paymentRecord } = await supabase
      .from("payments")
      .select(
        "id, organization_id, conversation_id, provider, provider_subscription_id, provider_subscription_status, mp_subscription_id, mp_subscription_status"
      )
      .eq("id", payload.paymentRecordId)
      .maybeSingle();

    const record = paymentRecord as {
      id: string;
      organization_id: string;
      conversation_id: string;
      provider: string | null;
      provider_subscription_id: string | null;
      provider_subscription_status: string | null;
      mp_subscription_id: string | null;
      mp_subscription_status: string | null;
    } | null;

    const provider =
      payload.paymentProvider ||
      record?.provider ||
      (record?.provider_subscription_id ? "stripe" : "mercado_pago");
    const recordSubscriptionId =
      provider === "stripe"
        ? record?.provider_subscription_id
        : record?.mp_subscription_id;

    if (
      !record ||
      record.organization_id !== payload.organizationId ||
      record.conversation_id !== payload.conversationId ||
      recordSubscriptionId !== payload.subscriptionId
    ) {
      return NextResponse.json(
        { ok: false, error: "Assinatura nao encontrada." },
        { status: 404 }
      );
    }

    if (!recordSubscriptionId) {
      return NextResponse.json(
        { ok: false, error: "Essa conversa nao possui assinatura recorrente ativa." },
        { status: 409 }
      );
    }

    let finalStatus =
      provider === "stripe"
        ? record.provider_subscription_status || null
        : record.mp_subscription_status || null;

    if (finalStatus !== "cancelled") {
      if (provider === "stripe") {
        const subscription = await cancelStripeSubscriptionAtPeriodEnd(
          recordSubscriptionId
        );
        finalStatus =
          subscription.cancel_at_period_end || subscription.status === "canceled"
            ? "cancelled"
            : subscription.status;
      } else {
        const settings = await getOrganizationSettingsById(payload.organizationId);
        const mpConfig = getMercadoPagoConfig(settings);

        if (!mpConfig.configured || !mpConfig.config) {
          return NextResponse.json(
            { ok: false, error: "Mercado Pago nao configurado." },
            { status: 503 }
          );
        }

        const subscription = await cancelMercadoPagoSubscription(
          recordSubscriptionId,
          mpConfig.config.accessToken
        );
        finalStatus = subscription.status || "cancelled";
      }
    }

    const paymentUpdate =
      provider === "stripe"
        ? {
            provider_subscription_status: finalStatus || "cancelled",
            updated_at: new Date().toISOString(),
          }
        : {
            mp_subscription_status: finalStatus || "cancelled",
            updated_at: new Date().toISOString(),
          };

    await supabase
      .from("payments")
      .update(paymentUpdate)
      .eq("id", record.id);

    await supabase
      .from("conversations")
      .update({
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.conversationId)
      .eq("organization_id", payload.organizationId);

    return NextResponse.json({
      ok: true,
      cancelled: true,
      alreadyCancelled:
        record.provider_subscription_status === "cancelled" ||
        record.mp_subscription_status === "cancelled",
    });
  } catch (error) {
    console.error("[subscription/cancel] failed", error);
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel cancelar a assinatura agora." },
      { status: 500 }
    );
  }
}
