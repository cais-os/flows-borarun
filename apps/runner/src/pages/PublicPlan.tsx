import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Loader2, RefreshCw, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchPublicRunnerPlan,
  generatePublicRunnerPlan,
  type PublicRunnerPlanResponse,
} from "@/lib/publicPlanApi";

function formatKm(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return numeric.toFixed(numeric % 1 === 0 ? 0 : 1).replace(".", ",");
}

function groupByWeek(trainings: PublicRunnerPlanResponse["trainings"]) {
  const map = new Map<number, PublicRunnerPlanResponse["trainings"]>();

  for (const training of trainings) {
    const weekNumber = Number(training.week_number || 0);
    if (!weekNumber) continue;

    const list = map.get(weekNumber) || [];
    list.push(training);
    map.set(weekNumber, list);
  }

  return Array.from(map.entries()).sort(([left], [right]) => left - right);
}

export default function PublicPlan() {
  const { phone = "" } = useParams();
  const [data, setData] = useState<PublicRunnerPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(
    () => groupByWeek(data?.trainings || []),
    [data?.trainings]
  );

  useEffect(() => {
    let alive = true;

    setLoading(true);
    setError(null);

    fetchPublicRunnerPlan(phone)
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((requestError) => {
        if (!alive) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar o plano."
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [phone]);

  const generate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const payload = await generatePublicRunnerPlan(phone);
      setData(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel gerar o plano."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <header className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">BoraRun</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Seu plano de corrida
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Link publico do WhatsApp para {phone}
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!data?.plan && (
          <Card className="rounded-[20px] border-none bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Plano ainda nao gerado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vamos montar seu plano com base nas respostas enviadas pelo
              WhatsApp.
            </p>
            <Button
              className="mt-5 w-full font-semibold"
              onClick={generate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando plano
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar meu plano
                </>
              )}
            </Button>
          </Card>
        )}

        {data?.plan && (
          <>
            <Card className="rounded-[20px] border-none bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Objetivo</p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {data.plan.goal_type || "Corrida"}
                  </h2>
                </div>
                <Route className="mt-1 h-6 w-6 text-primary" />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold">
                    {data.plan.total_weeks || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">semanas</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold">
                    {formatKm(data.plan.total_distance)}
                  </p>
                  <p className="text-xs text-muted-foreground">km</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold">{data.trainings.length}</p>
                  <p className="text-xs text-muted-foreground">treinos</p>
                </div>
              </div>
            </Card>

            <section className="mt-5 space-y-4">
              {weeks.map(([weekNumber, trainings]) => (
                <Card
                  key={weekNumber}
                  className="rounded-[20px] border-none bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold">Semana {weekNumber}</h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {trainings.map((training, index) => (
                      <div
                        key={`${weekNumber}-${training.date || index}-${training.title || training.name || index}`}
                        className="rounded-xl border border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {training.title || training.name || "Treino"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {training.day_of_week || "Dia a definir"}
                              {training.description
                                ? ` - ${training.description}`
                                : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold">
                            {formatKm(training.distance)} km
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
