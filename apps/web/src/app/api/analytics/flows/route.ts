import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import type { FlowAnalyticsSummary } from "@/types/analytics";

export async function GET(request: Request) {
  try {
    const context = await getCurrentOrganizationContext();
    const supabase = await createSupabaseServer();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Load all flows for the org
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, is_active")
      .eq("organization_id", context.organizationId)
      .order("updated_at", { ascending: false });

    if (flowsError) {
      console.error("[analytics/flows] flows query error:", flowsError.message);
    }

    if (!flows || flows.length === 0) {
      return NextResponse.json([]);
    }

    // Load executions with optional date filter
    let query = supabase
      .from("flow_executions")
      .select("flow_id, status")
      .eq("organization_id", context.organizationId);

    if (from) query = query.gte("started_at", from);
    if (to) query = query.lte("started_at", to);

    const { data: executions } = await query;

    // Aggregate per flow
    const execByFlow = new Map<
      string,
      { total: number; completed: number; abandoned: number }
    >();

    for (const exec of executions || []) {
      const flowId = exec.flow_id as string;
      const entry = execByFlow.get(flowId) || {
        total: 0,
        completed: 0,
        abandoned: 0,
      };
      entry.total++;
      if (exec.status === "completed") entry.completed++;
      if (exec.status === "abandoned") entry.abandoned++;
      execByFlow.set(flowId, entry);
    }

    const result: FlowAnalyticsSummary[] = flows.map((flow) => {
      const stats = execByFlow.get(flow.id as string) || {
        total: 0,
        completed: 0,
        abandoned: 0,
      };
      return {
        flowId: flow.id as string,
        flowName: (flow.name as string) || "Sem nome",
        isActive: Boolean(flow.is_active),
        totalExecutions: stats.total,
        completed: stats.completed,
        abandoned: stats.abandoned,
        completionRate:
          stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) / 100 : 0,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[analytics/flows] error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
