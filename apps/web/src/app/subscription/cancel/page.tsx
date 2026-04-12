import { CheckCircle2, CircleAlert, CircleOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CloseButton } from "@/app/strava/connected/close-button";
import { createServerClient } from "@/lib/supabase/server";
import {
  formatSubscriptionValidity,
  verifySubscriptionCancellationToken,
} from "@/lib/subscription-utils";
import { CancelCard } from "./cancel-card";

export const dynamic = "force-dynamic";

export default async function SubscriptionCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || null;
  const payload = verifySubscriptionCancellationToken(token);

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
                Esse link de cancelamento e invalido ou expirou. Se precisar,
                peca um novo link pelo WhatsApp.
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
  const { data: record } = await supabase
    .from("payments")
    .select(
      "id, plan_name, mp_subscription_status, conversation:conversations(subscription_expires_at)"
    )
    .eq("id", payload.paymentRecordId)
    .maybeSingle();

  const payment = record as {
    id: string;
    plan_name: string | null;
    mp_subscription_status: string | null;
    conversation:
      | {
          subscription_expires_at: string | null;
        }
      | {
          subscription_expires_at: string | null;
        }[]
      | null;
  } | null;

  if (!payment || payment.id !== payload.paymentRecordId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-4 text-center">
            <CircleOff className="mx-auto h-12 w-12 text-amber-600" />
            <div className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">
                Assinatura nao encontrada
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Nao consegui localizar essa assinatura. Se precisar, peca um
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

  const conversation = Array.isArray(payment.conversation)
    ? payment.conversation[0] || null
    : payment.conversation;
  const validUntil = formatSubscriptionValidity(
    conversation?.subscription_expires_at || null
  );
  const alreadyCancelled = payment.mp_subscription_status === "cancelled";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-slate-900" />
          <div className="space-y-2">
            <CardTitle className="text-2xl text-slate-900">
              Cancelar renovacao automatica
            </CardTitle>
            <CardDescription className="text-base text-slate-600">
              {payment.plan_name
                ? `Assinatura: ${payment.plan_name}.`
                : "Sua assinatura Premium esta pronta para cancelamento."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CancelCard
            token={token}
            validUntil={validUntil}
            alreadyCancelled={alreadyCancelled}
          />
        </CardContent>
      </Card>
    </main>
  );
}
