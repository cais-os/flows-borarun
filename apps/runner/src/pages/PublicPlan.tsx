import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicDailyTrainingCard } from "@/components/PublicDailyTrainingCard";
import { PublicTrainingDialog } from "@/components/PublicTrainingDialog";
import {
  fetchPublicRunnerPlan,
  generatePublicRunnerPlan,
  updatePublicRunnerTraining,
  type PublicRunnerPlanResponse,
} from "@/lib/publicPlanApi";
import { paceSecondsToFormatted } from "@/lib/utils";
import { filterVisibleTrainingsFromDate } from "@/lib/visibleTrainings";

type PublicTraining = PublicRunnerPlanResponse["trainings"][number];
type PublicTab = "agenda" | "plano";
type TrainingTypeKey = "long" | "recovery" | "interval" | "easy";

const WEEK_STARTS_ON = 1 as const;

const trainingTypeColors: Record<TrainingTypeKey, string> = {
  long: "#7acc16",
  recovery: "#7dd3fc",
  interval: "#a78bfa",
  easy: "#f97316",
};

const trainingTypeLabels: Record<TrainingTypeKey, string> = {
  long: "Longao",
  recovery: "Regenerativo",
  interval: "Tiros",
  easy: "Ritmo",
};

function parsePlanDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`);
}

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatKm(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return numeric.toFixed(numeric % 1 === 0 ? 0 : 1).replace(".", ",");
}

function getDurationSeconds(training: PublicTraining) {
  const elapsed = Number(training.elapsed_time || 0);
  if (elapsed > 0) return elapsed;
  return Number(training.duration || 0) * 60;
}

function formatDuration(seconds: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  if (!totalSeconds) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h${minutes}`;
  if (hours > 0) return `${hours}h`;
  return `${minutes} min`;
}

function normalizeTrainingType(type: string | null | undefined): TrainingTypeKey {
  if (type === "long" || type === "recovery" || type === "interval" || type === "easy") {
    return type;
  }

  return "easy";
}

function getTrainingTitle(training: PublicTraining) {
  return (
    training.title ||
    training.name ||
    trainingTypeLabels[normalizeTrainingType(training.type)] ||
    "Treino"
  );
}

function getTrainingDistance(training: PublicTraining, completedOnly = false) {
  if (completedOnly && !training.completed) return 0;
  if (completedOnly) return Number(training.actual_distance ?? training.distance ?? 0);
  return Number(training.distance ?? 0);
}

function getTrainingDuration(training: PublicTraining, completedOnly = false) {
  if (completedOnly && !training.completed) return 0;
  if (completedOnly) return Number(training.actual_elapsed_time ?? getDurationSeconds(training));
  return getDurationSeconds(training);
}

function kilometersToMeters(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return Math.round(numeric * 1000);
}

function parsePaceSeconds(value: string | null | undefined) {
  if (!value) return null;

  const text = value.trim().toLowerCase();
  const timeMatch = text.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (timeMatch) {
    const minutes = Number(timeMatch[1]);
    const seconds = Number(timeMatch[2]);

    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
  }

  const decimalMatch = text.match(/(\d{1,2})([,.]\d{1,2})/);
  if (decimalMatch) {
    const minutes = Number(decimalMatch[0].replace(",", "."));

    if (Number.isFinite(minutes)) {
      return Math.round(minutes * 60);
    }
  }

  return null;
}

function calculatePaceSeconds(distanceKm: number | null | undefined, elapsedSeconds: number | null | undefined) {
  const distance = Number(distanceKm || 0);
  const elapsed = Number(elapsedSeconds || 0);

  if (distance <= 0 || elapsed <= 0) return null;
  return Math.round(elapsed / distance);
}

function getRunnerComponentTraining(training: PublicTraining) {
  const plannedDistanceKm = Number(training.distance || 0);
  const plannedElapsedSeconds = getDurationSeconds(training);
  const actualDistanceKm = Number(training.actual_distance ?? 0);
  const actualElapsedSeconds = Number(training.actual_elapsed_time ?? 0);
  const plannedPaceSeconds =
    parsePaceSeconds(training.pace) ||
    calculatePaceSeconds(plannedDistanceKm, plannedElapsedSeconds);
  const actualPaceSeconds =
    parsePaceSeconds(training.actual_pace) ||
    calculatePaceSeconds(actualDistanceKm, actualElapsedSeconds);

  return {
    id: training.id || "",
    date: training.date || toDateKey(new Date()),
    type: normalizeTrainingType(training.type),
    title: getTrainingTitle(training),
    description: training.description,
    distance: kilometersToMeters(training.distance),
    elapsed_time: plannedElapsedSeconds,
    pace: plannedPaceSeconds,
    completed: Boolean(training.completed),
    actual_distance:
      training.actual_distance === null || training.actual_distance === undefined
        ? null
        : kilometersToMeters(training.actual_distance),
    actual_elapsed_time: training.actual_elapsed_time,
    actual_pace: actualPaceSeconds,
    difficulty_level: training.difficulty_level,
    feedbacks: training.feedbacks,
  };
}

function getActualPaceText(distanceMeters: number, elapsedSeconds: number) {
  const distanceKm = distanceMeters / 1000;
  const paceSeconds = calculatePaceSeconds(distanceKm, elapsedSeconds);

  return paceSeconds ? paceSecondsToFormatted(paceSeconds) : null;
}

function getTrainingDate(training: PublicTraining) {
  return parsePlanDate(training.date);
}

function getPlanStartDate(payload: PublicRunnerPlanResponse | null) {
  const explicitStart = parsePlanDate(payload?.plan?.start_date);
  if (explicitStart) return startOfWeek(explicitStart, { weekStartsOn: WEEK_STARTS_ON });

  const firstTrainingDate = (payload?.trainings || [])
    .map(getTrainingDate)
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime())[0];

  return firstTrainingDate
    ? startOfWeek(firstTrainingDate, { weekStartsOn: WEEK_STARTS_ON })
    : startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON });
}

function getInitialSelectedDate(payload: PublicRunnerPlanResponse) {
  const today = new Date();
  if (payload.plan || payload.trainings.length > 0) return today;

  return getPlanStartDate(payload);
}

function getWeekNumber(date: Date, planStart: Date) {
  return differenceInCalendarWeeks(
    startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
    planStart,
    { weekStartsOn: WEEK_STARTS_ON }
  ) + 1;
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function groupByWeek(trainings: PublicTraining[], planStart: Date) {
  const map = new Map<
    number,
    {
      weekNumber: number;
      startDate: Date;
      endDate: Date;
      trainings: PublicTraining[];
    }
  >();

  for (const training of trainings) {
    const trainingDate = getTrainingDate(training);
    const weekNumber = Number(training.week_number || (trainingDate ? getWeekNumber(trainingDate, planStart) : 0));
    if (!weekNumber) continue;

    const weekStart = trainingDate
      ? startOfWeek(trainingDate, { weekStartsOn: WEEK_STARTS_ON })
      : addWeeks(planStart, weekNumber - 1);
    const existing =
      map.get(weekNumber) ||
      {
        weekNumber,
        startDate: weekStart,
        endDate: addDays(weekStart, 6),
        trainings: [],
      };

    existing.trainings.push(training);
    map.set(weekNumber, existing);
  }

  return Array.from(map.values())
    .map((week) => ({
      ...week,
      trainings: week.trainings.sort((left, right) => {
        const leftDate = getTrainingDate(left)?.getTime() || 0;
        const rightDate = getTrainingDate(right)?.getTime() || 0;
        return leftDate - rightDate;
      }),
    }))
    .sort((left, right) => left.weekNumber - right.weekNumber);
}

function PublicBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: PublicTab;
  onTabChange: (tab: PublicTab) => void;
}) {
  const tabs = [
    { id: "agenda" as const, icon: CalendarDays, label: "Agenda" },
    { id: "plano" as const, icon: ClipboardList, label: "Plano" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-lg">
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex min-w-[72px] flex-col items-center justify-center gap-1 transition-colors"
            >
              <Icon
                className="h-6 w-6"
                style={{ color: isActive ? "#000000" : "#9ca3af" }}
                strokeWidth={2}
              />
              <span
                className={`text-xs ${isActive ? "font-bold" : "font-light"}`}
                style={{ color: isActive ? "#000000" : "#9ca3af" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AgendaView({
  data,
  selectedDate,
  currentWeek,
  onDateSelect,
  onWeekChange,
  onTrainingOpen,
  onTrainingComplete,
  onTrainingToggleComplete,
}: {
  data: PublicRunnerPlanResponse;
  selectedDate: Date;
  currentWeek: Date;
  onDateSelect: (date: Date) => void;
  onWeekChange: (date: Date) => void;
  onTrainingOpen: (training: PublicTraining) => void;
  onTrainingComplete: (
    training: PublicTraining,
    data: {
      distance: number;
      elapsedTime: number;
      difficultyLevel?: number | null;
      feedbacks?: string | null;
    }
  ) => void;
  onTrainingToggleComplete: (training: PublicTraining, checked: boolean) => void;
}) {
  const planStart = getPlanStartDate(data);
  const selectedKey = toDateKey(selectedDate);
  const currentWeekNumber = getWeekNumber(currentWeek, planStart);
  const totalWeeks = Number(data.plan?.total_weeks || 0);
  const weekDays = getWeekDays(currentWeek);
  const trainingsByDate = useMemo(() => {
    const map = new Map<string, PublicTraining[]>();

    for (const training of data.trainings) {
      if (!training.date) continue;
      const list = map.get(training.date) || [];
      list.push(training);
      map.set(training.date, list);
    }

    return map;
  }, [data.trainings]);
  const selectedTrainings = trainingsByDate.get(selectedKey) || [];
  const weekTrainings = weekDays.flatMap((day) => trainingsByDate.get(toDateKey(day)) || []);
  const completedRuns = weekTrainings.filter((training) => training.completed).length;
  const totalRuns = weekTrainings.length;
  const completedDistance = weekTrainings.reduce(
    (sum, training) => sum + getTrainingDistance(training, true),
    0
  );
  const totalDistance = weekTrainings.reduce(
    (sum, training) => sum + getTrainingDistance(training),
    0
  );
  const periodLabel = `${format(currentWeek, "d MMM", { locale: ptBR })} - ${format(
    addDays(currentWeek, 6),
    "d MMM",
    { locale: ptBR }
  )}`;

  return (
    <section className="pb-24 pt-5">
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Semana {Math.max(1, currentWeekNumber)}
              {totalWeeks ? `/${totalWeeks}` : ""}
            </p>
            <h2 className="truncate text-xl font-bold">{periodLabel}</h2>
          </div>

          <button
            type="button"
            onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm"
            aria-label="Proxima semana"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const key = toDateKey(day);
            const isSelected = isSameDay(day, selectedDate);
            const hasTraining = (trainingsByDate.get(key) || []).length > 0;
            const firstType = normalizeTrainingType(trainingsByDate.get(key)?.[0]?.type);

            return (
              <button
                key={key}
                type="button"
                onClick={() => onDateSelect(day)}
                className={`flex flex-col items-center gap-1.5 p-1 transition-all ${
                  isSelected ? "scale-110" : ""
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                </span>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                    isSelected
                      ? "border-2 border-foreground bg-card text-foreground shadow-lg"
                      : "border-2 border-black/20 bg-white text-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: hasTraining
                      ? trainingTypeColors[firstType]
                      : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        <Card className="rounded-[20px] border-none bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Corridas
          </p>
          <p className="mt-2 text-5xl font-bold leading-none">
            {completedRuns}/{totalRuns}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${totalRuns > 0 ? Math.min((completedRuns / totalRuns) * 100, 100) : 0}%`,
              }}
            />
          </div>
        </Card>

        <Card className="rounded-[20px] border-none bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Distancia
          </p>
          <p className="mt-2 text-4xl font-bold leading-none">
            {formatKm(completedDistance)}
            <span className="text-xl text-muted-foreground">
              /{formatKm(totalDistance)}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">km na semana</p>
        </Card>
      </div>

      <div className="space-y-4 px-4">
        {selectedTrainings.length > 0 ? (
          selectedTrainings.map((training, index) => {
            const runnerTraining = getRunnerComponentTraining(training);

            return (
              <PublicDailyTrainingCard
                key={training.id || `${training.date}-${training.title}-${index}`}
                trainingId={runnerTraining.id}
                date={runnerTraining.date}
                type={runnerTraining.type}
                title={runnerTraining.title}
                description={runnerTraining.description}
                elapsed_time={runnerTraining.elapsed_time}
                distance={runnerTraining.distance}
                completed={runnerTraining.completed}
                actual_distance={runnerTraining.actual_distance}
                actual_elapsed_time={runnerTraining.actual_elapsed_time}
                pace={runnerTraining.pace}
                actual_pace={runnerTraining.actual_pace}
                difficulty_level={runnerTraining.difficulty_level}
                feedbacks={runnerTraining.feedbacks}
                currentWeekNumber={Number(training.week_number || currentWeekNumber)}
                showDate
                source={training.source || "plan"}
                onOpenPlan={() => onTrainingOpen(training)}
                onCompletePlanTraining={(_, completionData) =>
                  onTrainingComplete(training, completionData)
                }
                onTogglePlanComplete={(_, checked) =>
                  onTrainingToggleComplete(training, checked)
                }
              />
            );
          })
        ) : (
          <Card className="rounded-[20px] border-none bg-card p-5 text-center shadow-sm">
            <h3 className="text-xl font-bold">Sem treino programado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use este dia para descanso, mobilidade ou uma caminhada leve.
            </p>
          </Card>
        )}
      </div>
    </section>
  );
}

function PlanSummary({ data }: { data: PublicRunnerPlanResponse }) {
  return (
    <section className="px-4 py-5">
      <p className="text-sm font-medium text-muted-foreground">
        Seu plano de corrida
      </p>
      <h2 className="text-3xl font-bold tracking-tight">
        Plano personalizado
      </h2>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Card className="rounded-[20px] border-none bg-card p-3 shadow-sm">
          <p className="text-lg font-bold">{data.plan?.total_weeks || 0}</p>
          <p className="text-xs text-muted-foreground">semanas</p>
        </Card>
        <Card className="rounded-[20px] border-none bg-card p-3 shadow-sm">
          <p className="text-lg font-bold">
            {formatKm(data.plan?.total_distance)}
          </p>
          <p className="text-xs text-muted-foreground">km</p>
        </Card>
        <Card className="rounded-[20px] border-none bg-card p-3 shadow-sm">
          <p className="text-lg font-bold">{data.trainings.length || 0}</p>
          <p className="text-xs text-muted-foreground">treinos</p>
        </Card>
      </div>
    </section>
  );
}

function PlanView({ data }: { data: PublicRunnerPlanResponse }) {
  const planStart = getPlanStartDate(data);
  const weeks = groupByWeek(data.trainings, planStart);

  return (
    <section className="space-y-4 px-4 pb-24">
      {weeks.length === 0 && (
        <Card className="rounded-[20px] border-none bg-card p-5 shadow-sm">
          <h3 className="break-words text-xl font-bold">
            Treinos ainda nao disponiveis
          </h3>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            O resumo do plano ja esta pronto, mas os treinos ainda nao foram
            carregados para este link.
          </p>
        </Card>
      )}

      {weeks.map((week) => {
        const totalTrainings = week.trainings.length;
        const completedTrainings = week.trainings.filter((training) => training.completed).length;
        const totalDistance = week.trainings.reduce(
          (sum, training) => sum + getTrainingDistance(training),
          0
        );
        const completedDistance = week.trainings.reduce(
          (sum, training) => sum + getTrainingDistance(training, true),
          0
        );
        const totalDuration = week.trainings.reduce(
          (sum, training) => sum + getTrainingDuration(training),
          0
        );
        const completedDuration = week.trainings.reduce(
          (sum, training) => sum + getTrainingDuration(training, true),
          0
        );

        return (
          <Card
            key={week.weekNumber}
            className="rounded-[20px] border-none bg-card p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-2xl font-bold">Semana {week.weekNumber}</h2>
              <div className="h-4 w-px bg-muted-foreground/30" />
              <p className="text-xs font-medium uppercase text-muted-foreground/70">
                {format(week.startDate, "d MMM", { locale: ptBR })} -{" "}
                {format(week.endDate, "d MMM", { locale: ptBR })}
              </p>
            </div>

            <div className="mb-3 flex gap-2">
              {Array.from({ length: totalTrainings }).map((_, index) => (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full ${
                    index < completedTrainings ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="mb-4 flex flex-col gap-2 text-sm">
              <p className="flex items-center text-muted-foreground">
                <MapPin className="mr-3 h-5 w-5 shrink-0" />
                <span className="font-brand-tertiary font-black text-foreground">
                  {formatKm(completedDistance)} km
                </span>
                <span className="mx-1">/</span>
                <span className="font-brand-tertiary">
                  {formatKm(totalDistance)} km
                </span>
              </p>

              <p className="flex items-center text-muted-foreground">
                <Clock className="mr-3 h-5 w-5 shrink-0" />
                <span className="font-brand-tertiary font-black text-foreground">
                  {formatDuration(completedDuration) || "0 min"}
                </span>
                <span className="mx-1">/</span>
                <span className="font-brand-tertiary">
                  {formatDuration(totalDuration) || "0 min"}
                </span>
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {week.trainings.map((training, index) => {
                const type = normalizeTrainingType(training.type);

                return (
                  <div
                    key={training.id || `${week.weekNumber}-${training.date}-${index}`}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="h-6 w-6 shrink-0 rounded-md"
                      style={{ backgroundColor: trainingTypeColors[type] }}
                    />
                    <span className="min-w-[36px] text-sm font-bold uppercase text-foreground">
                      {training.day_of_week?.slice(0, 3) || "Dia"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {getTrainingTitle(training)}
                    </span>
                    <span className="flex shrink-0 items-center text-sm text-foreground">
                      <MapPin className="mr-1 h-3 w-3" />
                      {formatKm(training.distance)} km
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

export default function PublicPlan() {
  const { phone = "" } = useParams();
  const [data, setData] = useState<PublicRunnerPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PublicTab>("agenda");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON })
  );
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [updatingTrainingId, setUpdatingTrainingId] = useState<string | null>(null);

  const generationStatus = data?.profile?.generation_status;
  const isGeneratingPlan = generationStatus === "generating";
  const hasFailedGeneration = generationStatus === "failed";
  const canGenerate =
    !data?.plan &&
    data?.found !== false &&
    !isGeneratingPlan &&
    (generationStatus === "idle" ||
      generationStatus === "failed" ||
      generationStatus === null ||
      generationStatus === undefined);
  const selectedTraining = useMemo(() => {
    if (!selectedTrainingId || !data) return null;
    return data.trainings.find((training) => training.id === selectedTrainingId) || null;
  }, [data, selectedTrainingId]);
  const visibleData = useMemo(
    () =>
      data
        ? {
            ...data,
            trainings: filterVisibleTrainingsFromDate(data.trainings),
          }
        : null,
    [data]
  );
  const selectedRunnerTraining = selectedTraining
    ? getRunnerComponentTraining(selectedTraining)
    : null;

  const applyPayload = (
    payload: PublicRunnerPlanResponse,
    options: { syncCalendar?: boolean } = {}
  ) => {
    setData(payload);

    if ((options.syncCalendar ?? true) && (payload.plan || payload.trainings.length > 0)) {
      const initialDate = getInitialSelectedDate(payload);
      setSelectedDate(initialDate);
      setCurrentWeek(startOfWeek(initialDate, { weekStartsOn: WEEK_STARTS_ON }));
    }
  };

  useEffect(() => {
    let alive = true;

    setLoading(true);
    setError(null);

    fetchPublicRunnerPlan(phone)
      .then((payload) => {
        if (!alive) return;
        applyPayload(payload);
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
      applyPayload(payload);
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

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentWeek(startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }));
  };

  const handleWeekChange = (weekStart: Date) => {
    const nextWeek = startOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON });
    const selectedOffset = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1;

    setCurrentWeek(nextWeek);
    setSelectedDate(addDays(nextWeek, selectedOffset));
  };

  const updateTrainingCompletion = async (
    training: PublicTraining,
    completed: boolean,
    completionData?: {
      distance: number;
      elapsedTime: number;
      difficultyLevel?: number | null;
      feedbacks?: string | null;
    }
  ) => {
    if (!training.id) {
      setError("Nao foi possivel identificar este treino.");
      return;
    }

    setUpdatingTrainingId(training.id);
    setError(null);

    try {
      const payload = await updatePublicRunnerTraining(phone, {
        trainingId: training.id,
        completed,
        actualDistance: completionData ? completionData.distance / 1000 : undefined,
        actualElapsedTime: completionData?.elapsedTime,
        actualPace: completionData
          ? getActualPaceText(completionData.distance, completionData.elapsedTime)
          : undefined,
        difficultyLevel: completionData?.difficultyLevel ?? null,
        feedbacks: completionData?.feedbacks ?? null,
      });

      applyPayload(payload, { syncCalendar: false });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel atualizar o treino."
      );
    } finally {
      setUpdatingTrainingId(null);
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
      <div className="mx-auto min-h-screen w-full max-w-md">
        <header
          className="relative w-full px-2 py-2"
          style={{ backgroundColor: "#daf46c" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-1 justify-center">
              <h1
                className="font-brand text-2xl font-black md:text-4xl"
                style={{ color: "#000000" }}
              >
                BORARUN
              </h1>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {data?.found === false && (
          <div className="px-4 pb-24">
            <Card className="rounded-[20px] border-none bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-semibold">
                    Link nao encontrado
                  </h2>
                  <p className="mt-2 break-words text-sm text-muted-foreground">
                    Peca um novo link pelo WhatsApp.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {data && data.found !== false && !data.plan && isGeneratingPlan && (
          <div className="px-4 pb-24">
            <Card className="rounded-[20px] border-none bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-semibold">
                    Plano em geracao
                  </h2>
                  <p className="mt-2 break-words text-sm text-muted-foreground">
                    Estamos montando seu plano. Volte em instantes para conferir.
                  </p>
                </div>
              </div>
              <Button className="mt-5 w-full font-semibold" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando plano
              </Button>
            </Card>
          </div>
        )}

        {data && data.found !== false && !data.plan && !isGeneratingPlan && (
          <div className="px-4 pb-24">
            <Card className="rounded-[20px] border-none bg-card p-5 shadow-sm">
              <h2 className="break-words text-xl font-semibold">
                {hasFailedGeneration
                  ? "Nao foi possivel gerar o plano"
                  : "Plano ainda nao gerado"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasFailedGeneration && data?.profile?.last_error
                  ? data.profile.last_error
                  : "Vamos montar seu plano com base nas respostas enviadas pelo WhatsApp."}
              </p>
              <Button
                className="mt-5 w-full font-semibold"
                onClick={generate}
                disabled={generating || !canGenerate}
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
          </div>
        )}

        {visibleData?.plan && (
          <>
            {activeTab === "agenda" ? (
              <AgendaView
                data={visibleData}
                selectedDate={selectedDate}
                currentWeek={currentWeek}
                onDateSelect={handleDateSelect}
                onWeekChange={handleWeekChange}
                onTrainingOpen={(training) => setSelectedTrainingId(training.id || null)}
                onTrainingComplete={(training, completionData) =>
                  updateTrainingCompletion(training, true, completionData)
                }
                onTrainingToggleComplete={(training, checked) =>
                  updateTrainingCompletion(training, checked)
                }
              />
            ) : (
              <>
                <PlanSummary data={visibleData} />
                <PlanView data={visibleData} />
              </>
            )}
          </>
        )}
      </div>

      {selectedTraining && selectedRunnerTraining && (
        <PublicTrainingDialog
          open={Boolean(selectedTrainingId)}
          onOpenChange={(open) => {
            if (!open) setSelectedTrainingId(null);
          }}
          training={selectedRunnerTraining}
          isUpdating={updatingTrainingId === selectedTraining.id}
          onCompletionChange={(checked) =>
            updateTrainingCompletion(selectedTraining, checked)
          }
          onCompleteTraining={(completionData) =>
            updateTrainingCompletion(selectedTraining, true, completionData)
          }
        />
      )}

      {visibleData?.plan && (
        <PublicBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </main>
  );
}
