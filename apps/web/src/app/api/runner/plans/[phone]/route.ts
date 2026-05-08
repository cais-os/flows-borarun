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
