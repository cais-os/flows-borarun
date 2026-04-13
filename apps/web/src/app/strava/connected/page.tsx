import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmbeddedWhatsAppOkHint } from "@/components/embedded-whatsapp-ok-hint";

const statusCopy = {
  success: {
    title: "Strava conectado",
    description:
      "Strava conectado com sucesso! Para voltar ao chat, clique no OK.",
    icon: CheckCircle2,
    tone: "text-emerald-600",
  },
  cancelled: {
    title: "Autorizacao cancelada",
    description:
      "Autorizacao cancelada. Para voltar ao chat, clique no OK e, se quiser, abra o link novamente pelo WhatsApp.",
    icon: CircleDashed,
    tone: "text-amber-600",
  },
  error: {
    title: "Nao foi possivel conectar",
    description:
      "Nao foi possivel conectar o Strava. Para voltar ao chat, clique no OK e tente novamente pelo link enviado no WhatsApp.",
    icon: CircleAlert,
    tone: "text-rose-600",
  },
} as const;

export default async function StravaConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const params = await searchParams;
  const current =
    statusCopy[(params.status as keyof typeof statusCopy) || "success"] ||
    statusCopy.success;
  const Icon = current.icon;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg space-y-3">
        <EmbeddedWhatsAppOkHint />
        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-4 text-center">
            <Icon className={`mx-auto h-12 w-12 ${current.tone}`} />
            <div className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">
                {current.title}
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                {params.message || current.description}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
