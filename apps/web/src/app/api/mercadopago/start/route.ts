import { NextResponse } from "next/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import { verifyMercadoPagoStartToken } from "@/lib/mercado-pago-start";
import {
  ensureMercadoPagoCheckoutForRecord,
  getMercadoPagoConfig,
  isValidMercadoPagoPayerEmail,
  loadMercadoPagoPaymentRecord,
} from "@/lib/mercado-pago";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      email?: string;
    };
    const payload = verifyMercadoPagoStartToken(body.token);

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "Link de pagamento invalido ou expirado." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const record = await loadMercadoPagoPaymentRecord({
      supabase,
      paymentRecordId: payload.paymentRecordId,
    });
    const { data: conversationRecord } = await supabase
      .from("conversations")
      .select("flow_variables")
      .eq("id", payload.conversationId)
      .eq("organization_id", payload.organizationId)
      .maybeSingle();

    const conversation = conversationRecord as {
      flow_variables?: Record<string, string> | null;
    } | null;

    if (
      !record ||
      record.organization_id !== payload.organizationId ||
      record.conversation_id !== payload.conversationId
    ) {
      return NextResponse.json(
        { ok: false, error: "Pagamento nao encontrado." },
        { status: 404 }
      );
    }

    const providedEmail = body.email?.trim() || "";
    const billingMode = record.billing_mode === "one_time" ? "one_time" : "recurring";
    const payerEmail = isValidMercadoPagoPayerEmail(providedEmail)
      ? providedEmail
      : record.payer_email;

    if (billingMode === "recurring" && !payerEmail) {
      return NextResponse.json(
        { ok: false, error: "Informe um e-mail valido para continuar." },
        { status: 400 }
      );
    }

    if (billingMode === "recurring" && payerEmail) {
      const vars = {
        ...((conversation?.flow_variables as Record<string, string>) || {}),
      };
      if (!vars.email) {
        vars.email = payerEmail;
      }
      vars.payer_email = payerEmail;

      await supabase
        .from("conversations")
        .update({
          flow_variables: vars,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.conversation_id)
        .eq("organization_id", record.organization_id);
    }

    const settings = await getOrganizationSettingsById(payload.organizationId);
    const mpConfig = getMercadoPagoConfig(settings);

    if (!mpConfig.configured || !mpConfig.config) {
      return NextResponse.json(
        { ok: false, error: "Mercado Pago nao configurado." },
        { status: 503 }
      );
    }

    const checkout = await ensureMercadoPagoCheckoutForRecord({
      supabase,
      paymentRecordId: payload.paymentRecordId,
      organizationId: payload.organizationId,
      accessToken: mpConfig.config.accessToken,
      payerEmail,
    });

    return NextResponse.json({
      ok: true,
      redirectUrl: checkout.initPoint,
    });
  } catch (error) {
    console.error("[mercadopago/start] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Nao foi possivel iniciar o pagamento agora. Tente novamente em instantes.",
      },
      { status: 500 }
    );
  }
}
