import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const statusCopy = {
  success: {
    title: "Pagamento confirmado",
    description:
      "Sua assinatura foi ativada com sucesso. Voce ja pode voltar para a conversa no WhatsApp.",
    icon: CheckCircle2,
    tone: "text-emerald-600",
  },
  pending: {
    title: "Pagamento em processamento",
    description:
      "Seu pagamento esta sendo processado. Voce sera notificado pelo WhatsApp assim que for confirmado.",
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

export default async function MercadoPagoStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    s?: string;
    preference_id?: string;
    external_reference?: string;
  }>;
}) {
  const params = await searchParams;
  const current =
    statusCopy[(params.s as keyof typeof statusCopy) || "success"] ||
    statusCopy.success;
  const Icon = current.icon;

  let retryUrl: string | null = null;

  if (params.s === "failure" && params.preference_id && params.external_reference) {
    try {
      const ref = JSON.parse(params.external_reference) as {
        organizationId?: string;
      };
      if (ref.organizationId) {
        retryUrl = `/api/mercadopago/retry?preference_id=${encodeURIComponent(params.preference_id)}&org=${encodeURIComponent(ref.organizationId)}`;
      }
    } catch {
      // invalid external_reference — no retry button
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
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
        <CardContent className="flex justify-center gap-3">
          {retryUrl ? (
            <Button asChild className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <a href={retryUrl}>Tentar novamente</a>
            </Button>
          ) : (
            <Button asChild className="rounded-xl bg-slate-900 hover:bg-slate-800">
              <Link href="/">Fechar</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
