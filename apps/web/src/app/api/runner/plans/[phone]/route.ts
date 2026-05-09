import { NextResponse } from "next/server";
import {
  generateAndPersistRunnerPlan,
  getPublicRunnerPlan,
  getRunnerProfileByPhone,
  sanitizeRunnerProfileForPublic,
} from "@/lib/runner/plan-store";
import { buildRunnerPlanUrl, getRunnerAppBaseUrl } from "@/lib/runner/url";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ phone: string }>;
};

type FlowVariables = Record<string, string>;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      process.env.RUNNER_APP_ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(),
      ...init?.headers,
    },
  });
}

function buildWebAppLink(request: Request, phone: string) {
  const requestOrigin = new URL(request.url).origin;
  return buildRunnerPlanUrl({
    baseUrl: getRunnerAppBaseUrl(requestOrigin),
    phone,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function GET(request: Request, { params }: RouteContext) {
  const { phone } = await params;
  const supabase = createServerClient();
  let webAppLink = "";

  try {
    webAppLink = buildWebAppLink(request, phone);
    const publicPlan = await getPublicRunnerPlan({ supabase, phone });

    if (!publicPlan) {
      return jsonResponse(
        {
          profile: null,
          plan: null,
          trainings: [],
          webAppLink,
        },
        { status: 404 }
      );
    }

    return jsonResponse({
      ...publicPlan,
      webAppLink,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load runner plan";

    console.error("[runner-plans] Failed to load plan:", error);

    return jsonResponse(
      {
        error: message,
        profile: null,
        plan: null,
        trainings: [],
        webAppLink,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { phone } = await params;
  const supabase = createServerClient();
  let webAppLink = "";
  let profile: Awaited<ReturnType<typeof getRunnerProfileByPhone>> | null = null;

  try {
    webAppLink = buildWebAppLink(request, phone);
    profile = await getRunnerProfileByPhone(supabase, phone);

    if (!profile) {
      return jsonResponse(
        {
          profile: null,
          plan: null,
          trainings: [],
          webAppLink,
        },
        { status: 404 }
      );
    }

    const existing = await getPublicRunnerPlan({ supabase, phone });
    if (existing?.plan && existing.trainings.length > 0) {
      return jsonResponse({
        ...existing,
        webAppLink,
      });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, organization_id, flow_variables")
      .eq("id", profile.conversation_id)
      .single();

    if (conversationError) throw conversationError;
    if (!conversation) throw new Error("Runner conversation not found");

    const flowVariables =
      ((conversation.flow_variables as FlowVariables | null) || {});
    const generationResult = await generateAndPersistRunnerPlan({
      supabase,
      runnerProfileId: profile.id,
      conversationId: conversation.id,
      organizationId: conversation.organization_id,
      flowVariables,
    });

    return jsonResponse({
      ...(generationResult.publicPlan || {
        profile: sanitizeRunnerProfileForPublic(profile),
        plan: null,
        trainings: [],
      }),
      webAppLink,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate runner plan";

    console.error("[runner-plans] Failed to generate plan:", error);

    return jsonResponse(
      {
        error: message,
        profile: sanitizeRunnerProfileForPublic(profile),
        plan: null,
        trainings: [],
        webAppLink,
      },
      { status: 500 }
    );
  }
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function optionalInteger(value: unknown) {
  const numeric = optionalNumber(value);
  if (numeric === null) return null;
  const integer = Math.trunc(numeric);
  return integer >= 1 && integer <= 5 ? integer : null;
}

async function refreshRunnerPlanCompletionTotals(
  supabase: ReturnType<typeof createServerClient>,
  trainingPlanId: string
) {
  const { data: trainings, error } = await supabase
    .from("weekly_trainings")
    .select("week_number, distance, actual_distance, completed")
    .eq("training_plan_id", trainingPlanId);

  if (error) throw error;

  const weekStats = new Map<number, { total: number; completed: number }>();
  const completedDistance = (trainings || []).reduce((sum, training) => {
    const weekNumber = Number(training.week_number || 0);
    if (weekNumber) {
      const stats = weekStats.get(weekNumber) || { total: 0, completed: 0 };
      stats.total += 1;
      if (training.completed) stats.completed += 1;
      weekStats.set(weekNumber, stats);
    }

    if (!training.completed) return sum;
    return sum + Number(training.actual_distance ?? training.distance ?? 0);
  }, 0);
  const completedWeeks = Array.from(weekStats.values()).filter(
    (stats) => stats.total > 0 && stats.completed === stats.total
  ).length;

  const { error: updateError } = await supabase
    .from("training_plans")
    .update({
      completed_distance: completedDistance,
      completed_weeks: completedWeeks,
    })
    .eq("id", trainingPlanId);

  if (updateError) throw updateError;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { phone } = await params;
  const supabase = createServerClient();
  let webAppLink = "";

  try {
    webAppLink = buildWebAppLink(request, phone);
    const payload = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const trainingId =
      typeof payload.trainingId === "string" ? payload.trainingId.trim() : "";
    const completed =
      typeof payload.completed === "boolean" ? payload.completed : null;

    if (!trainingId || completed === null) {
      return jsonResponse(
        {
          error: "trainingId and completed are required",
          profile: null,
          plan: null,
          trainings: [],
          webAppLink,
        },
        { status: 400 }
      );
    }

    const profile = await getRunnerProfileByPhone(supabase, phone);
    if (!profile) {
      return jsonResponse(
        {
          profile: null,
          plan: null,
          trainings: [],
          webAppLink,
        },
        { status: 404 }
      );
    }

    const updatePayload = completed
      ? {
          completed: true,
          completed_at: new Date().toISOString(),
          actual_distance: optionalNumber(payload.actualDistance),
          actual_elapsed_time: optionalNumber(payload.actualElapsedTime),
          actual_time:
            typeof payload.actualTime === "string" ? payload.actualTime : null,
          actual_pace:
            typeof payload.actualPace === "string" ? payload.actualPace : null,
          difficulty_level: optionalInteger(payload.difficultyLevel),
          feedbacks:
            typeof payload.feedbacks === "string" ? payload.feedbacks : null,
        }
      : {
          completed: false,
          completed_at: null,
          actual_distance: null,
          actual_elapsed_time: null,
          actual_time: null,
          actual_pace: null,
          difficulty_level: null,
          feedbacks: null,
        };

    const { data: updatedTraining, error: updateError } = await supabase
      .from("weekly_trainings")
      .update(updatePayload)
      .eq("id", trainingId)
      .eq("runner_profile_id", profile.id)
      .select("training_plan_id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedTraining?.training_plan_id) {
      return jsonResponse(
        {
          error: "Training not found",
          profile: sanitizeRunnerProfileForPublic(profile),
          plan: null,
          trainings: [],
          webAppLink,
        },
        { status: 404 }
      );
    }

    await refreshRunnerPlanCompletionTotals(
      supabase,
      String(updatedTraining.training_plan_id)
    );

    const publicPlan = await getPublicRunnerPlan({ supabase, phone });

    return jsonResponse({
      ...(publicPlan || {
        profile: sanitizeRunnerProfileForPublic(profile),
        plan: null,
        trainings: [],
      }),
      webAppLink,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update training";

    console.error("[runner-plans] Failed to update training:", error);

    return jsonResponse(
      {
        error: message,
        profile: null,
        plan: null,
        trainings: [],
        webAppLink,
      },
      { status: 500 }
    );
  }
}
