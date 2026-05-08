export const FLOW_API_BASE_URL =
  import.meta.env.VITE_FLOW_API_BASE_URL || window.location.origin;

export type PublicRunnerPlanResponse = {
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

export async function fetchPublicRunnerPlan(phone: string) {
  const response = await fetch(
    `${FLOW_API_BASE_URL}/api/runner/plans/${encodeURIComponent(phone)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar o plano.");
  }

  return (await response.json()) as PublicRunnerPlanResponse;
}

export async function generatePublicRunnerPlan(phone: string) {
  const response = await fetch(
    `${FLOW_API_BASE_URL}/api/runner/plans/${encodeURIComponent(phone)}`,
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

  return (await response.json()) as PublicRunnerPlanResponse;
}
