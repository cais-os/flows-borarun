import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import type { FlowFunnelData, FlowFunnelNode } from "@/types/analytics";
import type { NodeData, TriggerNodeData } from "@/types/node-data";

interface FlowNode {
  id: string;
  data: NodeData;
}

interface FlowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

function getNodeLabel(data: NodeData): string {
  const labels: Record<string, string> = {
    trigger: "Trigger",
    sendMessage: "Enviar mensagem",
    waitForReply: "Aguardar resposta",
    randomizer: "Randomizador",
    tagConversation: "Adicionar tag",
    generatePdf: "Gerar PDF",
    waitTimer: "Aguardar tempo",
    finishFlow: "Finalizar flow",
    aiCollector: "AI Coletor",
    stravaConnect: "Conectar Strava",
  };

  if (data.type === "trigger") {
    const triggerData = data as TriggerNodeData;
    if (triggerData.triggerType === "keyword" && triggerData.keyword) {
      return `Keyword: "${triggerData.keyword}"`;
    }
    if (triggerData.triggerType === "newContact") return "Novo contato";
    if (triggerData.triggerType === "tag") return `Tag: ${triggerData.tagName || ""}`;
    if (triggerData.triggerType === "subscriptionPlan") {
      return `Subscription: ${triggerData.subscriptionPlan || ""}`;
    }
  }

  return (data as { label?: string }).label || labels[data.type] || data.type;
}

/** BFS from trigger node to get execution order */
function getOrderedNodes(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowNode[] {
  const trigger = nodes.find((n) => n.data.type === "trigger");
  if (!trigger) return nodes;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }

  const ordered: FlowNode[] = [];
  const visited = new Set<string>();
  const queue = [trigger.id];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (node) ordered.push(node);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }

  return ordered;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const context = await getCurrentOrganizationContext();
    const supabase = await createSupabaseServer();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Load flow definition
    const { data: flow } = await supabase
      .from("flows")
      .select("nodes, edges")
      .eq("id", flowId)
      .eq("organization_id", context.organizationId)
      .single();

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const nodes = flow.nodes as unknown as FlowNode[];
    const edges = flow.edges as unknown as FlowEdge[];

    // Execution stats
    let execQuery = supabase
      .from("flow_executions")
      .select("status")
      .eq("flow_id", flowId)
      .eq("organization_id", context.organizationId);

    if (from) execQuery = execQuery.gte("started_at", from);
    if (to) execQuery = execQuery.lte("started_at", to);

    const { data: executions } = await execQuery;

    let totalExecutions = 0;
    let completed = 0;
    let abandoned = 0;

    for (const exec of executions || []) {
      totalExecutions++;
      if (exec.status === "completed") completed++;
      if (exec.status === "abandoned") abandoned++;
    }

    // Node events count
    let eventsQuery = supabase
      .from("flow_node_events")
      .select("node_id")
      .eq("flow_id", flowId)
      .eq("organization_id", context.organizationId);

    if (from) eventsQuery = eventsQuery.gte("entered_at", from);
    if (to) eventsQuery = eventsQuery.lte("entered_at", to);

    const { data: events } = await eventsQuery;

    const visitCounts = new Map<string, number>();
    for (const event of events || []) {
      const nodeId = event.node_id as string;
      visitCounts.set(nodeId, (visitCounts.get(nodeId) || 0) + 1);
    }

    // Build ordered funnel
    const orderedNodes = getOrderedNodes(nodes, edges);
    const triggerVisits = totalExecutions || 1;

    let previousVisits = triggerVisits;
    const funnelNodes: FlowFunnelNode[] = orderedNodes.map((node) => {
      const visits = visitCounts.get(node.id) || 0;
      const percentage =
        triggerVisits > 0
          ? Math.round((visits / triggerVisits) * 1000) / 10
          : 0;
      const dropOff = previousVisits - visits;
      previousVisits = visits;

      return {
        nodeId: node.id,
        nodeType: node.data.type,
        label: getNodeLabel(node.data),
        visits,
        percentage,
        dropOff: Math.max(0, dropOff),
      };
    });

    const result: FlowFunnelData = {
      totalExecutions,
      completed,
      abandoned,
      nodes: funnelNodes,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
