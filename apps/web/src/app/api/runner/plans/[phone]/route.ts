import { NextResponse } from "next/server";
import {
  getPublicRunnerPlan,
  getRunnerProfileByPhone,
  persistRunnerPlan,
  sanitizeRunnerProfileForPublic,
} from "@/lib/runner/plan-store";
import { buildRunnerPlanUrl, getRunnerAppBaseUrl } from "@/lib/runner/url";
import { createServerClient } from "@/lib/supabase/server";
import { generateTrainingPlanData } from "@/lib/training-plan-generator";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ phone: string }>;
};

type FlowVariables = Record<string, string>;

const GENERATION_TIMEOUT_MS = 45_000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      process.env.RUNNER_APP_ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function serializePlanVariable(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function markProfileGenerationStatus(params: {
  supabase: ReturnType<typeof createServerClient>;
  profileId: string;
  status: "generating" | "failed";
  lastError?: string;
}) {
  const payload =
    params.status === "failed"
      ? {
          generation_status: params.status,
          last_error: params.lastError || "Failed to generate runner plan",
        }
      : {
          generation_status: params.status,
          last_error: null,
        };

  const { error } = await params.supabase
    .from("runner_profiles")
    .update(payload)
    .eq("id", params.profileId);

  if (error) throw error;
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

    await markProfileGenerationStatus({
      supabase,
      profileId: profile.id,
      status: "generating",
    });

    const flowVariables =
      ((conversation.flow_variables as FlowVariables | null) || {});
    const { planData, coachingSummary } = await withTimeout(
      generateTrainingPlanData({
        flowVariables,
      }),
      GENERATION_TIMEOUT_MS,
      "Runner plan generation timed out"
    );
    const planGeneratedAt = new Date().toISOString();
    const startDate =
      typeof flowVariables.data_inicio_plano === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(flowVariables.data_inicio_plano)
        ? flowVariables.data_inicio_plano.slice(0, 10)
        : planGeneratedAt.slice(0, 10);
    const nextFlowVariables: FlowVariables = {
      ...flowVariables,
      _training_plan: serializePlanVariable(planData),
      _coaching_summary: serializePlanVariable(coachingSummary),
      _plan_generated_at: planGeneratedAt,
    };

    const { error: updateConversationError } = await supabase
      .from("conversations")
      .update({ flow_variables: nextFlowVariables })
      .eq("id", conversation.id);

    if (updateConversationError) throw updateConversationError;

    const persisted = await persistRunnerPlan({
      supabase,
      runnerProfileId: profile.id,
      conversationId: conversation.id,
      organizationId: conversation.organization_id,
      startDate,
      planData,
      coachingSummary,
    });

    return jsonResponse({
      ...(persisted || {
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

    try {
      if (profile) {
        await markProfileGenerationStatus({
          supabase,
          profileId: profile.id,
          status: "failed",
          lastError: message,
        });
      }
    } catch (statusError) {
      console.error("[runner-plans] Failed to mark generation failure:", statusError);
    }

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
