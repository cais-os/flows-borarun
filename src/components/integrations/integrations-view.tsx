"use client";

import { useEffect, useState } from "react";
import {
  Footprints,
  Loader2,
  MessageCircle,
  Plug,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type IntegrationHealth = {
  configured: boolean;
  missing?: string[];
  callbackUrl?: string;
  callbackPath?: string;
  scopes?: string[];
};

const requiredStravaVars = [
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "NEXT_PUBLIC_APP_URL",
];

export function IntegrationsView() {
  const [metaHealth, setMetaHealth] = useState<IntegrationHealth | null>(null);
  const [stravaHealth, setStravaHealth] = useState<IntegrationHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const [metaResponse, stravaResponse] = await Promise.all([
          fetch("/api/meta/health"),
          fetch("/api/strava/health"),
        ]);

        const [metaData, stravaData] = (await Promise.all([
          metaResponse.json(),
          stravaResponse.json(),
        ])) as [IntegrationHealth, IntegrationHealth];

        if (!cancelled) {
          setMetaHealth(metaData);
          setStravaHealth(stravaData);
        }
      } catch (error) {
        console.error("Failed to load integration health", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Plug size={20} />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-900">
                  Integracoes ativas
                </CardTitle>
                <CardDescription>
                  WhatsApp continua como canal principal e o Strava passa a
                  alimentar o contexto do coach com corridas reais do atleta.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-600 p-3 text-white">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Meta WhatsApp
                    </p>
                    <p className="text-sm text-slate-600">
                      Entrada e saida das conversas.
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    metaHealth?.configured
                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                      : "bg-white text-slate-700"
                  }
                >
                  {metaHealth?.configured ? "Configurado" : "Pendente"}
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  Quando o atleta pedir para conectar o Strava no WhatsApp, o
                  sistema agora consegue mandar o link certo e receber o retorno
                  do OAuth.
                </p>
                {!metaHealth?.configured && metaHealth?.missing?.length ? (
                  <p className="text-rose-600">
                    Variaveis pendentes: {metaHealth.missing.join(", ")}
                  </p>
                ) : (
                  <p className="text-emerald-700">
                    Canal pronto para enviar o link de integracao e confirmar a
                    conexao automaticamente.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-orange-50/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500 p-3 text-white">
                    <Footprints size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Strava OAuth
                    </p>
                    <p className="text-sm text-slate-600">
                      Corridas, volume e sincronizacao por conversa.
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    stravaHealth?.configured
                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                      : "bg-white text-slate-700"
                  }
                >
                  {stravaHealth?.configured ? "Configurado" : "Pendente"}
                </Badge>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Callback cadastrado no Strava:
                  <span className="mt-1 block rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-700">
                    {stravaHealth?.callbackUrl || "Nao disponivel"}
                  </span>
                </p>

                <div>
                  <p className="font-medium text-slate-900">Scopes usados</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(stravaHealth?.scopes || []).map((scope) => (
                      <Badge
                        key={scope}
                        variant="secondary"
                        className="bg-white text-slate-700"
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>

                {!stravaHealth?.configured && (
                  <p className="text-rose-600">
                    Variaveis pendentes:{" "}
                    {stravaHealth?.missing?.join(", ") || requiredStravaVars.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">
                Fluxo da integracao Strava
              </CardTitle>
              <CardDescription>
                O atleta autoriza uma vez e o coach passa a trabalhar com os
                dados recentes das corridas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                1. O atleta pede a conexao no WhatsApp ou o operador envia o
                link pela conversa.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                2. O sistema redireciona para o OAuth do Strava e salva tokens
                por conversa.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                3. As atividades recentes entram em `strava_activities` e ficam
                disponiveis para sincronizacao manual ou automatica.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                4. O AI Coach passa a considerar volume semanal, corrida mais
                recente e longao nas respostas.
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <CardTitle className="text-lg text-slate-900">
                    Variaveis obrigatorias
                  </CardTitle>
                  <CardDescription>
                    Configure no ambiente antes de publicar.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              {requiredStravaVars.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                >
                  {item}
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 px-3 py-3 text-xs text-orange-900">
                A migration da integracao cria `strava_connections` e
                `strava_activities`. Sem isso a conexao OAuth ate abre, mas nao
                ha onde persistir os dados do atleta.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
