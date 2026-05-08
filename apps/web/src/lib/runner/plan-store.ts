import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPlanToRunnerRows } from "@/lib/runner/plan-mapper";
import { normalizeRunnerPhone } from "@/lib/runner/phone";

type RunnerSupabaseClient = SupabaseClient<any, any, any>;
type PublicRunnerProfile = ReturnType<typeof sanitizeRunnerProfileForPublic>;
type PublicRunnerPlan = ReturnType<typeof sanitizeRunnerPlanForPublic>;
type PublicRunnerTraining = ReturnType<typeof sanitizeRunnerTrainingForPublic>;
type PublicRunnerPlanPayload = {
  profile: PublicRunnerProfile;
  plan: PublicRunnerPlan;
  trainings: PublicRunnerTraining[];
};

const PROFILE_INTERNAL_COLUMNS =
  "id, phone, normalized_phone, conversation_id, organization_id, generation_status, generated_at, last_error";
const PLAN_PUBLIC_COLUMNS =
  "goal_type, goal_distance, race_date, start_date, total_weeks, total_distance, completed_distance, completed_weeks";
const PLAN_QUERY_COLUMNS = `id, ${PLAN_PUBLIC_COLUMNS}`;
const TRAINING_PUBLIC_COLUMNS =
  "week_number, day_of_week, date, type, name, title, description, distance, pace, duration, elapsed_time, completed, completed_at, actual_distance, actual_elapsed_time, actual_time, actual_pace, difficulty_level, feedbacks, source";

export function sanitizeRunnerProfileForPublic(
  profile: Record<string, unknown> | null | undefined
) {
  if (!profile) return null;

  return {
    phone: profile.phone ?? null,
    normalized_phone: profile.normalized_phone ?? null,
    generation_status: profile.generation_status ?? null,
    generated_at: profile.generated_at ?? null,
    last_error: profile.last_error ?? null,
  };
}

export function sanitizeRunnerPlanForPublic(
  plan: Record<string, unknown> | null | undefined
) {
  if (!plan) return null;

  return {
    goal_type: plan.goal_type ?? null,
    goal_distance: plan.goal_distance ?? null,
    race_date: plan.race_date ?? null,
    start_date: plan.start_date ?? null,
    total_weeks: plan.total_weeks ?? null,
    total_distance: plan.total_distance ?? null,
    completed_distance: plan.completed_distance ?? null,
    completed_weeks: plan.completed_weeks ?? null,
  };
}

export function sanitizeRunnerTrainingForPublic(
  training: Record<string, unknown>
) {
  return {
    week_number: training.week_number ?? null,
    day_of_week: training.day_of_week ?? null,
    date: training.date ?? null,
    type: training.type ?? null,
    name: training.name ?? null,
    title: training.title ?? null,
    description: training.description ?? null,
    distance: training.distance ?? null,
    pace: training.pace ?? null,
    duration: training.duration ?? null,
    elapsed_time: training.elapsed_time ?? null,
    completed: training.completed ?? null,
    completed_at: training.completed_at ?? null,
    actual_distance: training.actual_distance ?? null,
    actual_elapsed_time: training.actual_elapsed_time ?? null,
    actual_time: training.actual_time ?? null,
    actual_pace: training.actual_pace ?? null,
    difficulty_level: training.difficulty_level ?? null,
    feedbacks: training.feedbacks ?? null,
    source: training.source ?? null,
  };
}

export function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "23505" ||
    (typeof candidate.message === "string" &&
      candidate.message.toLowerCase().includes("duplicate key"))
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalGenerationStatus(status: unknown) {
  return status === "completed" || status === "failed";
}

function isCompleteOrSafeConflictResult(
  publicPlan: PublicRunnerPlanPayload | null
) {
  return (
    !publicPlan ||
    !publicPlan.plan ||
    publicPlan.trainings.length > 0
  );
}

export function coercePartialConflictRunnerPlanToGenerating(
  publicPlan: PublicRunnerPlanPayload | null
) {
  if (!publicPlan || isCompleteOrSafeConflictResult(publicPlan)) {
    return publicPlan;
  }

  return {
    profile: publicPlan.profile,
    plan: null,
    trainings: [],
  };
}

export async function getCompletedPublicRunnerPlanAfterConflict(params: {
  supabase: RunnerSupabaseClient;
  phone: string;
  attempts?: number;
  delayMs?: number;
  loadPublicPlan?: () => Promise<PublicRunnerPlanPayload | null>;
}) {
  const attempts = Math.max(1, params.attempts ?? 5);
  const delayMs = Math.max(0, params.delayMs ?? 250);
  const loadPublicPlan =
    params.loadPublicPlan ||
    (() =>
      getPublicRunnerPlan({
        supabase: params.supabase,
        phone: params.phone,
      }));

  let latest: PublicRunnerPlanPayload | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    latest = await loadPublicPlan();

    if (isCompleteOrSafeConflictResult(latest)) {
      return latest;
    }

    if (
      latest &&
      isTerminalGenerationStatus(latest.profile?.generation_status)
    ) {
      return coercePartialConflictRunnerPlanToGenerating(latest);
    }

    if (attempt < attempts - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return coercePartialConflictRunnerPlanToGenerating(latest);
}

export async function getRunnerProfileByPhone(
  supabase: RunnerSupabaseClient,
  phone: string
) {
  const normalizedPhone = normalizeRunnerPhone(phone);
  const { data, error } = await supabase
    .from("runner_profiles")
    .select(PROFILE_INTERNAL_COLUMNS)
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureRunnerProfile(params: {
  supabase: RunnerSupabaseClient;
  phone: string;
  conversationId: string;
  organizationId: string;
}) {
  const normalizedPhone = normalizeRunnerPhone(params.phone);
  const { data, error } = await params.supabase
    .from("runner_profiles")
    .upsert(
      {
        phone: params.phone,
        normalized_phone: normalizedPhone,
        conversation_id: params.conversationId,
        organization_id: params.organizationId,
      },
      { onConflict: "normalized_phone" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPublicRunnerPlan(params: {
  supabase: RunnerSupabaseClient;
  phone: string;
}) {
  const profile = await getRunnerProfileByPhone(params.supabase, params.phone);
  if (!profile) return null;

  const { data: plan, error: planError } = await params.supabase
    .from("training_plans")
    .select(PLAN_QUERY_COLUMNS)
    .eq("runner_profile_id", profile.id)
    .maybeSingle();

  if (planError) throw planError;

  if (!plan) {
    return {
      profile: sanitizeRunnerProfileForPublic(profile),
      plan: null,
      trainings: [],
    };
  }

  const { data: trainings, error: trainingsError } = await params.supabase
    .from("weekly_trainings")
    .select(TRAINING_PUBLIC_COLUMNS)
    .eq("training_plan_id", plan.id)
    .order("week_number", { ascending: true })
    .order("date", { ascending: true });

  if (trainingsError) throw trainingsError;

  return {
    profile: sanitizeRunnerProfileForPublic(profile),
    plan: sanitizeRunnerPlanForPublic(plan),
    trainings: (trainings || []).map(sanitizeRunnerTrainingForPublic),
  };
}

export async function persistRunnerPlan(params: {
  supabase: RunnerSupabaseClient;
  runnerProfileId: string;
  conversationId: string;
  organizationId: string;
  startDate: string;
  planData: Record<string, unknown>;
  coachingSummary: Record<string, unknown>;
}) {
  const { data: profile, error: profileError } = await params.supabase
    .from("runner_profiles")
    .select("phone")
    .eq("id", params.runnerProfileId)
    .single();

  if (profileError) throw profileError;

  const { data: existingPlan, error: existingPlanError } = await params.supabase
    .from("training_plans")
    .select("id")
    .eq("runner_profile_id", params.runnerProfileId)
    .maybeSingle();

  if (existingPlanError) throw existingPlanError;

  const trainingPlanId = existingPlan?.id || randomUUID();
  const mapped = mapPlanToRunnerRows({
    runnerProfileId: params.runnerProfileId,
    trainingPlanId,
    startDate: params.startDate,
    planData: params.planData,
  });
  const planPayload = {
    ...mapped.plan,
    conversation_id: params.conversationId,
    organization_id: params.organizationId,
    coaching_summary: params.coachingSummary,
  };

  const planResult = existingPlan
    ? await params.supabase
        .from("training_plans")
        .update(planPayload)
        .eq("id", trainingPlanId)
        .select()
        .single()
    : await params.supabase
        .from("training_plans")
        .insert({ id: trainingPlanId, ...planPayload })
        .select()
        .single();

  if (planResult.error) {
    if (!existingPlan && isUniqueViolation(planResult.error)) {
      return getCompletedPublicRunnerPlanAfterConflict({
        supabase: params.supabase,
        phone: String(profile.phone || ""),
      });
    }

    throw planResult.error;
  }
  const plan = planResult.data;

  const { error: deleteError } = await params.supabase
    .from("weekly_trainings")
    .delete()
    .eq("training_plan_id", plan.id);

  if (deleteError) throw deleteError;

  if (mapped.trainings.length > 0) {
    const { error: trainingsError } = await params.supabase
      .from("weekly_trainings")
      .insert(
        mapped.trainings.map((training) => ({
          ...training,
          training_plan_id: plan.id,
        }))
      );

    if (trainingsError) throw trainingsError;
  }

  const { error: statusError } = await params.supabase
    .from("runner_profiles")
    .update({
      generation_status: "completed",
      generated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", params.runnerProfileId);

  if (statusError) throw statusError;

  return getPublicRunnerPlan({
    supabase: params.supabase,
    phone: String(profile.phone || ""),
  });
}
