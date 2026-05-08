import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPlanToRunnerRows } from "@/lib/runner/plan-mapper";
import { normalizeRunnerPhone } from "@/lib/runner/phone";

type RunnerSupabaseClient = SupabaseClient<any, any, any>;

export async function getRunnerProfileByPhone(
  supabase: RunnerSupabaseClient,
  phone: string
) {
  const normalizedPhone = normalizeRunnerPhone(phone);
  const { data, error } = await supabase
    .from("runner_profiles")
    .select("*")
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
    .select("*")
    .eq("runner_profile_id", profile.id)
    .maybeSingle();

  if (planError) throw planError;

  if (!plan) {
    return {
      profile,
      plan: null,
      trainings: [],
    };
  }

  const { data: trainings, error: trainingsError } = await params.supabase
    .from("weekly_trainings")
    .select("*")
    .eq("training_plan_id", plan.id)
    .order("week_number", { ascending: true })
    .order("date", { ascending: true });

  if (trainingsError) throw trainingsError;

  return {
    profile,
    plan,
    trainings: trainings || [],
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

  if (planResult.error) throw planResult.error;
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
