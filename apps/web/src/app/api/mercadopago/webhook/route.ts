import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTextMessage,
} from "@/lib/meta";
import {
  getMercadoPagoConfig,
  fetchMercadoPagoPayment,
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

    const supabase = createServerClient();

    // Update payment record
    await supabase
      .from("payments")
      .update({
        mp_payment_id: String(mpPayment.id),
        status: mpPayment.status,
        paid_at: mpPayment.date_approved || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ref.paymentRecordId);

    // If approved, activate subscription
    if (mpPayment.status === "approved") {
      // Load payment record for plan details
      const { data: paymentRecord } = await supabase
        .from("payments")
        .select("plan_name, duration_days")
        .eq("id", ref.paymentRecordId)
        .single();

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
            const confirmMsg = `Pagamento confirmado! Sua assinatura do plano "${paymentRecord.plan_name}" foi ativada com sucesso. Validade: ${paymentRecord.duration_days} dias.`;

            const result = await sendMetaWhatsAppTextMessage(
              { to: conversation.contact_phone, body: confirmMsg },
              metaConfig
            );

            await supabase.from("messages").insert({
              conversation_id: ref.conversationId,
              content: confirmMsg,
              type: "text",
              sender: "bot",
              wa_message_id: result.messageId,
            });
          }
        } catch (msgErr) {
          console.error("[MP Webhook] Failed to send confirmation message:", msgErr);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    // Always return 200 to avoid MP retries
    return NextResponse.json({ ok: true });
  }
}
