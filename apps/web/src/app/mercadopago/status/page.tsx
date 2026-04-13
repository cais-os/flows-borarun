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
  reconcileMercadoPagoPayment,
  reconcileMercadoPagoPaymentByExternalReference,
  reconcileMercadoPagoPaymentByPreferenceId,
  reconcileMercadoPagoPaymentRecord,
  type ReconcileMercadoPagoPaymentResult,
} from "@/lib/mercado-pago-reconciliation";
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

function extractOrganizationId(
  orgParam: string | null,
  externalReference: string | null
) {
  if (orgParam) return orgParam;
  if (!externalReference) return null;

  try {
    const parsed = JSON.parse(externalReference) as {
      organizationId?: string;
    };

    return typeof parsed.organizationId === "string"
      ? parsed.organizationId
      : null;
  } catch {
    return null;
  }
}

function mapPaymentStatusToPageStatus(
  paymentStatus: string | undefined
): StatusKey | null {
  if (!paymentStatus) return null;

  if (paymentStatus === "approved") return "success";
  if (paymentStatus === "pending" || paymentStatus === "in_process") {
    return "pending";
  }
  if (
    paymentStatus === "rejected" ||
    paymentStatus === "cancelled" ||
    paymentStatus === "refunded" ||
    paymentStatus === "charged_back"
  ) {
    return "failure";
  }

  return null;
}

function getStatusFromReconciliation(
  result: ReconcileMercadoPagoPaymentResult | null,
  fallbackStatus: StatusKey
) {
  if (!result) return fallbackStatus;
  if (result.status === "approved") return "success";
  if (result.status === "not_approved") {
    return mapPaymentStatusToPageStatus(result.paymentStatus) || "pending";
  }

  return fallbackStatus;
}

async function reconcileSuccessStatus(params: {
  orgId: string | null;
  paymentId: string | null;
  collectionId: string | null;
  externalReference: string | null;
  preferenceId: string | null;
  paymentRecordId: string | null;
}) {
  if (!params.orgId) {
    return null;
  }

  const settings = await getOrganizationSettingsById(params.orgId);
  const supabase = createServerClient();
  const resolvedPaymentId = params.paymentId || params.collectionId;

  try {
    if (resolvedPaymentId) {
      return await reconcileMercadoPagoPayment({
        supabase,
        organizationId: params.orgId,
        settings,
        paymentId: resolvedPaymentId,
        source: "payment",
      });
    }

    if (params.paymentRecordId) {
      return await reconcileMercadoPagoPaymentRecord({
        supabase,
        organizationId: params.orgId,
        settings,
        paymentRecordId: params.paymentRecordId,
      });
    }

    if (params.externalReference) {
      return await reconcileMercadoPagoPaymentByExternalReference({
        supabase,
        organizationId: params.orgId,
        settings,
        externalReference: params.externalReference,
        source: "external_reference",
      });
    }

    if (params.preferenceId) {
      return await reconcileMercadoPagoPaymentByPreferenceId({
        supabase,
        organizationId: params.orgId,
        settings,
        preferenceId: params.preferenceId,
      });
    }
  } catch (error) {
    console.error("[mercadopago/status] failed to reconcile payment", error);
  }

  return null;
}

export default async function MercadoPagoStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    s?: string;
    org?: string;
    payment_id?: string;
    collection_id?: string;
    preference_id?: string;
    external_reference?: string;
    payment_record_id?: string;
  }>;
}) {
  const params = await searchParams;
  const fallbackStatusKey = parseStatusKey(params.s);
  const incomingStatus = statusCopy[fallbackStatusKey] || statusCopy.success;

  const orgId = extractOrganizationId(
    normalizeParam(params.org),
    normalizeParam(params.external_reference)
  );
  const paymentId = normalizeParam(params.payment_id);
  const collectionId = normalizeParam(params.collection_id);
  const preferenceId = normalizeParam(params.preference_id);
  const externalReference = normalizeParam(params.external_reference);
  const paymentRecordId = normalizeParam(params.payment_record_id);

  const reconciliation =
    orgId &&
    (paymentId ||
      collectionId ||
      preferenceId ||
      externalReference ||
      paymentRecordId)
      ? await reconcileSuccessStatus({
          orgId,
          paymentId,
          collectionId,
          preferenceId,
          externalReference,
          paymentRecordId,
        })
      : null;

  const currentStatusKey = getStatusFromReconciliation(
    reconciliation,
    fallbackStatusKey
  );
  const current = statusCopy[currentStatusKey] || incomingStatus;
  const Icon = current.icon;

  let retryUrl: string | null = null;

  if (currentStatusKey === "failure" && orgId) {
    if (paymentRecordId) {
      retryUrl = `/api/mercadopago/retry?payment_record_id=${encodeURIComponent(paymentRecordId)}&org=${encodeURIComponent(orgId)}`;
    } else if (preferenceId) {
      retryUrl = `/api/mercadopago/retry?preference_id=${encodeURIComponent(preferenceId)}&org=${encodeURIComponent(orgId)}`;
    }
  }

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
              <Button
                asChild
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                <a href={retryUrl}>Tentar novamente</a>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
