export const FLOW_API_BASE_URL = import.meta.env.VITE_FLOW_API_BASE_URL;

const FLOW_API_CONFIG_ERROR =
  "VITE_FLOW_API_BASE_URL precisa apontar para o backend dos flows.";

export type PublicRunnerPlanResponse = {
  found: boolean;
  profile: {
    phone: string | null;
    normalized_phone: string | null;
    generation_status: "idle" | "generating" | "completed" | "failed" | null;
    generated_at: string | null;
    last_error: string | null;
  } | null;
  plan: {
    goal_type: string | null;
    goal_distance: number | null;
    race_date: string | null;
    start_date: string | null;
    total_weeks: number | null;
    total_distance: number | null;
    completed_distance: number | null;
    completed_weeks: number | null;
  } | null;
  trainings: Array<{
    week_number: number | null;
    day_of_week: string | null;
    date: string | null;
    type: string | null;
    name: string | null;
    title: string | null;
    description: string | null;
    distance: number | null;
    pace: string | null;
    duration: number | null;
    elapsed_time: number | null;
    completed: boolean | null;
    completed_at: string | null;
    actual_distance: number | null;
    actual_elapsed_time: number | null;
    actual_time: string | null;
    actual_pace: string | null;
    difficulty_level: string | null;
    feedbacks: string | null;
    source: string | null;
  }>;
  webAppLink?: string;
};

function getFlowApiBaseUrl() {
  if (typeof FLOW_API_BASE_URL !== "string") {
    throw new Error(FLOW_API_CONFIG_ERROR);
  }

  try {
    const url = new URL(FLOW_API_BASE_URL);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(FLOW_API_CONFIG_ERROR);
    }

    return FLOW_API_BASE_URL.replace(/\/+$/, "");
  } catch {
    throw new Error(FLOW_API_CONFIG_ERROR);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asGenerationStatus(value: unknown) {
  return value === "idle" ||
    value === "generating" ||
    value === "completed" ||
    value === "failed"
    ? value
    : null;
}

function normalizePublicRunnerPlanResponse(
  payload: unknown,
  found = true
): PublicRunnerPlanResponse {
  const root = asRecord(payload);
  const profile = root.profile ? asRecord(root.profile) : null;
  const plan = root.plan ? asRecord(root.plan) : null;
  const trainings = Array.isArray(root.trainings) ? root.trainings : [];

  return {
    found,
    profile: profile
      ? {
          phone: asString(profile.phone),
          normalized_phone: asString(profile.normalized_phone),
          generation_status: asGenerationStatus(profile.generation_status),
          generated_at: asString(profile.generated_at),
          last_error: asString(profile.last_error),
        }
      : null,
    plan: plan
      ? {
          goal_type: asString(plan.goal_type),
          goal_distance: asNumber(plan.goal_distance),
          race_date: asString(plan.race_date),
          start_date: asString(plan.start_date),
          total_weeks: asNumber(plan.total_weeks),
          total_distance: asNumber(plan.total_distance),
          completed_distance: asNumber(plan.completed_distance),
          completed_weeks: asNumber(plan.completed_weeks),
        }
      : null,
    trainings: trainings.map((training) => {
      const item = asRecord(training);

      return {
        week_number: asNumber(item.week_number),
        day_of_week: asString(item.day_of_week),
        date: asString(item.date),
        type: asString(item.type),
        name: asString(item.name),
        title: asString(item.title),
        description: asString(item.description),
        distance: asNumber(item.distance),
        pace: asString(item.pace),
        duration: asNumber(item.duration),
        elapsed_time: asNumber(item.elapsed_time),
        completed: asBoolean(item.completed),
        completed_at: asString(item.completed_at),
        actual_distance: asNumber(item.actual_distance),
        actual_elapsed_time: asNumber(item.actual_elapsed_time),
        actual_time: asString(item.actual_time),
        actual_pace: asString(item.actual_pace),
        difficulty_level: asString(item.difficulty_level),
        feedbacks: asString(item.feedbacks),
        source: asString(item.source),
      };
    }),
    webAppLink: asString(root.webAppLink) || undefined,
  };
}

export async function fetchPublicRunnerPlan(phone: string) {
  const baseUrl = getFlowApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/runner/plans/${encodeURIComponent(phone)}`
  );

  if (response.status === 404) {
    return normalizePublicRunnerPlanResponse(
      { profile: null, plan: null, trainings: [] },
      false
    );
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar o plano.");
  }

  return normalizePublicRunnerPlanResponse(await response.json());
}

export async function generatePublicRunnerPlan(phone: string) {
  const baseUrl = getFlowApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/runner/plans/${encodeURIComponent(phone)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel gerar o plano."
    );
  }

  return normalizePublicRunnerPlanResponse(await response.json());
}
