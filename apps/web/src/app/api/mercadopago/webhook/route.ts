import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTextMessage,
  sendMetaWhatsAppInteractiveListMessage,
} from "@/lib/meta";
import {
  getMercadoPagoConfig,
  fetchMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercado-pago";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org");

    const body = (await request.json()) as {
      action?: string;
      type?: string;
      data?: { id?: string };
    };

    console.log("[MP Webhook] Received:", body.type, body.action, body.data?.id);

    // Only process payment notifications
    if (body.type !== "payment" || !body.data?.id) {
      return NextResponse.json({ ok: true });
    }

    if (!orgId) {
      console.error("[MP Webhook] Missing org query param");
      return NextResponse.json({ ok: true });
    }

    // Load org settings to get MP access token
    const settings = await getOrganizationSettingsById(orgId);
    const mpConfig = getMercadoPagoConfig(settings);

    if (!mpConfig.configured || !mpConfig.config) {
      console.error("[MP Webhook] MP not configured for org", orgId);
      return NextResponse.json({ ok: true });
    }

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
        paymentId: body.data?.id || null,
      });
      return NextResponse.json(
        { ok: false, error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Fetch payment details from Mercado Pago
    const mpPayment = await fetchMercadoPagoPayment(
      body.data.id,
      mpConfig.config.accessToken
    );

    console.log("[MP Webhook] Payment status:", mpPayment.status, "ref:", mpPayment.external_reference);

    // Parse external reference
    let ref: { paymentRecordId: string; conversationId: string; organizationId: string };
    try {
      ref = JSON.parse(mpPayment.external_reference);
    } catch {
      console.error("[MP Webhook] Invalid external_reference:", mpPayment.external_reference);
      return NextResponse.json({ ok: true });
    }

    if (ref.organizationId !== orgId) {
      console.error("[MP Webhook] Organization mismatch:", {
        queryOrgId: orgId,
        refOrgId: ref.organizationId,
      });
      return NextResponse.json({ ok: true });
    }

    const supabase = createServerClient();

    const { data: paymentRecord } = await supabase
      .from("payments")
      .select("id, organization_id, conversation_id, amount, currency, status, mp_payment_id, plan_name, duration_days")
      .eq("id", ref.paymentRecordId)
      .maybeSingle();

    if (!paymentRecord) {
      console.error("[MP Webhook] Payment record not found:", ref.paymentRecordId);
      return NextResponse.json({ ok: true });
    }

    if (
      paymentRecord.organization_id !== orgId ||
      paymentRecord.conversation_id !== ref.conversationId
    ) {
      console.error("[MP Webhook] Payment record context mismatch:", {
        paymentRecordId: ref.paymentRecordId,
        queryOrgId: orgId,
        recordOrgId: paymentRecord.organization_id,
        referenceConversationId: ref.conversationId,
        recordConversationId: paymentRecord.conversation_id,
      });
      return NextResponse.json({ ok: true });
    }

    if (
      Number(paymentRecord.amount) !== Number(mpPayment.transaction_amount) ||
      paymentRecord.currency !== mpPayment.currency_id
    ) {
      console.error("[MP Webhook] Payment amount/currency mismatch:", {
        paymentRecordId: ref.paymentRecordId,
        expectedAmount: paymentRecord.amount,
        receivedAmount: mpPayment.transaction_amount,
        expectedCurrency: paymentRecord.currency,
        receivedCurrency: mpPayment.currency_id,
      });
      return NextResponse.json({ ok: true });
    }

    // If approved, activate subscription (with idempotency check)
    if (mpPayment.status === "approved") {
      if (
        paymentRecord.status === "approved" &&
        paymentRecord.mp_payment_id === String(mpPayment.id)
      ) {
        console.log("[MP Webhook] Payment already processed:", mpPayment.id);
        return NextResponse.json({ ok: true });
      }

      await supabase
        .from("payments")
        .update({
          mp_payment_id: String(mpPayment.id),
          status: mpPayment.status,
          paid_at: mpPayment.date_approved || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ref.paymentRecordId);

      if (paymentRecord) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + paymentRecord.duration_days);

        // Get current renewal count
        const { data: conv } = await supabase
          .from("conversations")
          .select("subscription_renewed_count")
          .eq("id", ref.conversationId)
          .single();

        await supabase
          .from("conversations")
          .update({
            subscription_status: "active",
            subscription_plan: paymentRecord.plan_name,
            subscription_started_at: new Date().toISOString(),
            subscription_expires_at: expiresAt.toISOString(),
            subscription_renewed_count: (conv?.subscription_renewed_count || 0) + 1,
          })
          .eq("id", ref.conversationId);

        // Send WhatsApp confirmation
        try {
          const { data: conversation } = await supabase
            .from("conversations")
            .select("contact_phone")
            .eq("id", ref.conversationId)
            .single();

          if (conversation?.contact_phone) {
            const { config: metaConfig } = getMetaConfigFromSettings(settings);

            // Message 1: Congratulations
            const congratsMsg = "Parabens! Voce assinou o plano Premium com sucesso. A partir de agora esta liberado a conversar com a IA assessora de corrida!";
            const r1 = await sendMetaWhatsAppTextMessage(
              { to: conversation.contact_phone, body: congratsMsg },
              metaConfig
            );
            await supabase.from("messages").insert({
              conversation_id: ref.conversationId,
              content: congratsMsg,
              type: "text",
              sender: "bot",
              wa_message_id: r1.messageId,
            });

            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Message 2: Ask preferred day for weekly training updates
            const dayMsg = "Vamos te enviar os treinos atualizados semanalmente de acordo com sua evolucao. Qual dia da semana prefere receber seus treinos?";
            const r2 = await sendMetaWhatsAppInteractiveListMessage(
              {
                to: conversation.contact_phone,
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
              metaConfig
            );
            await supabase.from("messages").insert({
              conversation_id: ref.conversationId,
              content: dayMsg,
              type: "interactive",
              sender: "bot",
              wa_message_id: r2.messageId,
            });

            // Set flag so webhook knows to capture the day/hour preference
            const { data: convVars } = await supabase
              .from("conversations")
              .select("flow_variables")
              .eq("id", ref.conversationId)
              .single();
            const fv = (convVars?.flow_variables as Record<string, string>) || {};
            fv._awaiting_weekly_day = "true";
            await supabase
              .from("conversations")
              .update({ flow_variables: fv })
              .eq("id", ref.conversationId);
          }
        } catch (msgErr) {
          console.error("[MP Webhook] Failed to send confirmation message:", msgErr);
        }
      }
    } else {
      await supabase
        .from("payments")
        .update({
          mp_payment_id: String(mpPayment.id),
          status: mpPayment.status,
          paid_at: mpPayment.date_approved || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ref.paymentRecordId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    // Always return 200 to avoid MP retries
    return NextResponse.json({ ok: true });
  }
}
