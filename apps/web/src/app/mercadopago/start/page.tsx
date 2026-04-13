import { CircleAlert, CreditCard, MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CloseButton } from "@/app/strava/connected/close-button";
import { loadMercadoPagoPaymentRecord } from "@/lib/mercado-pago";
import { createServerClient } from "@/lib/supabase/server";
import { verifyMercadoPagoStartToken } from "@/lib/mercado-pago-start";
import { StartCard } from "./start-card";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amount);
}

export default async function MercadoPagoStartPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || null;
  const payload = verifyMercadoPagoStartToken(token);

  if (!payload || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-4 text-center">
            <CircleAlert className="mx-auto h-12 w-12 text-rose-600" />
            <div className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">
                Link invalido
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Esse link de pagamento e invalido ou expirou. Se precisar,
                peca um novo link no WhatsApp.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CloseButton />
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = createServerClient();
  const payment = await loadMercadoPagoPaymentRecord({
    supabase,
    paymentRecordId: payload.paymentRecordId,
  });

  if (
    !payment ||
    payment.organization_id !== payload.organizationId ||
    payment.conversation_id !== payload.conversationId
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-4 text-center">
            <CircleAlert className="mx-auto h-12 w-12 text-amber-600" />
            <div className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">
                Pagamento nao encontrado
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Nao consegui localizar esse pagamento. Se precisar, peca um
                novo link pelo WhatsApp.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CloseButton />
          </CardContent>
        </Card>
      </main>
    );
  }

  const amount = Number(payment.amount) || 0;
  const currency = payment.currency || "BRL";
  const requiresEmail =
    (payment.billing_mode || "recurring") === "recurring" &&
    !payment.payer_email;
  const HeaderIcon = requiresEmail ? MailCheck : CreditCard;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-4 text-center">
          <HeaderIcon className="mx-auto h-12 w-12 text-emerald-600" />
          <div className="space-y-2">
            <CardTitle className="text-2xl text-slate-900">
              Finalizar pagamento
            </CardTitle>
            <CardDescription className="text-base text-slate-600">
              {payment.plan_name
                ? `${payment.plan_name} • ${formatCurrency(amount, currency)}`
                : formatCurrency(amount, currency)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <StartCard
            token={token}
            initialEmail={payment.payer_email || ""}
            requiresEmail={requiresEmail}
          />
        </CardContent>
      </Card>
    </main>
  );
}
