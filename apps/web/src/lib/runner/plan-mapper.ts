type JsonRecord = Record<string, unknown>;

const DAY_OFFSETS: Record<string, number> = {
  segunda: 0,
  "segunda-feira": 0,
  terca: 1,
  "terca-feira": 1,
  quarta: 2,
  "quarta-feira": 2,
  quinta: 3,
  "quinta-feira": 3,
  sexta: 4,
  "sexta-feira": 4,
  sabado: 5,
  "sabado-feira": 5,
  domingo: 6,
};

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function parseNumber(value: unknown) {
  const parsed = Number(asString(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(startDate: string, weekIndex: number) {
  return addDays(new Date(`${startDate}T00:00:00.000Z`), weekIndex * 7);
}

function inferTrainingType(day: JsonRecord) {
  const text = [
    day.tipo,
    day.treino,
    day.descricao,
    day.parte_principal,
    day.name,
    day.title,
  ]
    .map(normalizeText)
    .join(" ");

  if (text.includes("long")) return "long";
  if (text.includes("tiro") || text.includes("interval")) return "interval";
  if (text.includes("regener") || text.includes("recuper")) return "recovery";
  return "easy";
}

function getGoalType(planData: JsonRecord) {
  const athleteProfile =
    typeof planData.perfil_atleta === "object" && planData.perfil_atleta
      ? (planData.perfil_atleta as JsonRecord)
      : {};

  return (
    asString(athleteProfile.objetivo) ||
    asString(planData.objetivo) ||
    asString(planData.goal_type) ||
    "corrida"
  );
}

export function mapPlanToRunnerRows(params: {
  runnerProfileId: string;
  trainingPlanId: string;
  startDate: string;
  planData: JsonRecord;
}) {
  const weeks = Array.isArray(params.planData.semanas)
    ? (params.planData.semanas as JsonRecord[])
    : [];

  const trainings = weeks.flatMap((week, weekIndex) => {
    const weekNumber = Number(week.semana || week.week || weekIndex + 1);
    const days = Array.isArray(week.dias) ? (week.dias as JsonRecord[]) : [];
    const weekStart = getWeekStart(params.startDate, weekIndex);

    return days.map((day, dayIndex) => {
      const dayLabel =
        asString(day.dia) || asString(day.dia_semana) || `Dia ${dayIndex + 1}`;
      const offset = DAY_OFFSETS[normalizeText(dayLabel)] ?? dayIndex;
      const distance = parseNumber(day.distancia_km || day.km);
      const durationMinutes = parseNumber(day.duracao_min || day.duracao);
      const title =
        asString(day.treino) ||
        asString(day.tipo) ||
        asString(day.parte_principal) ||
        "Treino do plano";

      return {
        training_plan_id: params.trainingPlanId,
        runner_profile_id: params.runnerProfileId,
        week_number: Number.isFinite(weekNumber) ? weekNumber : weekIndex + 1,
        day_of_week: dayLabel,
        date: toIsoDate(addDays(weekStart, offset)),
        type: inferTrainingType(day),
        name: title,
        title,
        description:
          asString(day.descricao) ||
          asString(day.parte_principal) ||
          asString(day.notas),
        distance,
        pace: asString(day.pace_alvo),
        duration: durationMinutes,
        elapsed_time: durationMinutes * 60,
        source: "plan",
      };
    });
  });

  const totalDistance = trainings.reduce(
    (sum, training) => sum + training.distance,
    0
  );

  return {
    plan: {
      runner_profile_id: params.runnerProfileId,
      goal_type: getGoalType(params.planData),
      goal_distance: 0,
      start_date: params.startDate,
      total_weeks: weeks.length,
      total_distance: totalDistance,
      completed_distance: 0,
      completed_weeks: 0,
      raw_plan: params.planData,
    },
    trainings,
  };
}
