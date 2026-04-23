import { CheckCircle2, CircleAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmbeddedWhatsAppOkHint } from "@/components/embedded-whatsapp-ok-hint";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  reconcileStripeCheckoutSession,
  type ReconcileStripePaymentResult,
} from "@/lib/stripe-payments";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const statusCopy = {
  success: {
    title: "Pagamento confirmado",
    description:
      "Pagamento realizado com sucesso! Para voltar ao chat, clique no OK.",
    icon: CheckCircle2,
    tone: "text-emerald-600",
  },
  pending: {
    title: "Pagamento em processamento",
    description:
      "Pagamento em processamento. Para voltar ao chat, clique no OK. Voce sera notificado pelo WhatsApp assim que for confirmado.",
    icon: Clock,
    tone: "text-amber-600",
  },
  failure: {
    title: "Pagamento nao aprovado",
    description:
      "Nao foi possivel concluir o pagamento. Tente novamente clicando no botao abaixo.",
    icon: CircleAlert,
    tone: "text-rose-600",
  },
} as const;

type StatusKey = keyof typeof statusCopy;

function parseStatusKey(value?: string): StatusKey {
  if (value === "pending" || value === "failure" || value === "success") {
    return value;
  }

  return "success";
}

function normalizeParam(value?: string) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return null;
  }

  return normalized;
}

function getStatusFromReconciliation(
  result: ReconcileStripePaymentResult | null,
  fallbackStatus: StatusKey
) {
  if (!result) return fallbackStatus;
  if (result.status === "approved") return "success";
  if (result.status === "not_approved") return "pending";
  return fallbackStatus;
}

async function reconcileSuccessStatus(params: {
  orgId: string | null;
  sessionId: string | null;
}) {
  if (!params.orgId || !params.sessionId) {
    return null;
  }

  const settings = await getOrganizationSettingsById(params.orgId);
  const supabase = createServerClient();

  try {
    return await reconcileStripeCheckoutSession({
      supabase,
      settings,
      sessionId: params.sessionId,
      organizationId: params.orgId,
    });
  } catch (error) {
    console.error("[stripe/status] failed to reconcile payment", error);
    return null;
  }
}

export default async function StripeStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    s?: string;
    org?: string;
    session_id?: string;
    payment_record_id?: string;
  }>;
}) {
  const params = await searchParams;
  const fallbackStatusKey = parseStatusKey(params.s);
  const incomingStatus = statusCopy[fallbackStatusKey] || statusCopy.success;

  const orgId = normalizeParam(params.org);
  const sessionId = normalizeParam(params.session_id);
  const paymentRecordId = normalizeParam(params.payment_record_id);

  const reconciliation =
    fallbackStatusKey === "success"
      ? await reconcileSuccessStatus({
          orgId,
          sessionId,
        })
      : null;

  const currentStatusKey = getStatusFromReconciliation(
    reconciliation,
    fallbackStatusKey
  );
  const current = statusCopy[currentStatusKey] || incomingStatus;
  const Icon = current.icon;

  const retryUrl =
    currentStatusKey === "failure" && orgId && paymentRecordId
      ? `/api/stripe/retry?payment_record_id=${encodeURIComponent(paymentRecordId)}&org=${encodeURIComponent(orgId)}`
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg space-y-3">
        {currentStatusKey !== "failure" ? <EmbeddedWhatsAppOkHint /> : null}
        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-4 text-center">
            <Icon className={`mx-auto h-12 w-12 ${current.tone}`} />
            <div className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">
                {current.title}
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                {current.description}
              </CardDescription>
            </div>
          </CardHeader>
          {retryUrl ? (
            <CardContent className="flex justify-center gap-3">
              <Button asChild className="rounded-xl bg-slate-900 hover:bg-slate-800">
                <a href={retryUrl}>Tentar novamente</a>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
