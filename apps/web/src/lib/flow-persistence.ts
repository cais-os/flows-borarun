import type { Flow } from "@/types/flow";
import type { NodeData, TriggerNodeData } from "@/types/node-data";

const LOCAL_FLOWS_STORAGE_KEY = "borarun:flows";

export const DEFAULT_FLOW_NAME = "Novo Flow";

type FlowDraft = Omit<Partial<Flow>, "nodes"> &
  Pick<Flow, "id"> & {
    nodes?: Array<{ data: NodeData }>;
  };

function hasWindow() {
  return typeof window !== "undefined";
}

export function normalizeFlow(flow: FlowDraft): Flow {
  const now = new Date().toISOString();

  return {
    id: flow.id,
    name: flow.name || DEFAULT_FLOW_NAME,
    description: flow.description,
    isActive: Boolean(flow.isActive),
    nodes: (flow.nodes as Flow["nodes"]) || [],
    edges: flow.edges || [],
    created_at: flow.created_at || now,
    updated_at: flow.updated_at || now,
  };
}

export function sortFlows(flows: Flow[]): Flow[] {
  return [...flows].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

export function upsertFlowInCollection(
  flows: Flow[],
  draft: FlowDraft
): Flow[] {
  const existingIndex = flows.findIndex((flow) => flow.id === draft.id);
  const existing = existingIndex >= 0 ? flows[existingIndex] : undefined;
  const merged = normalizeFlow({
    ...existing,
    ...draft,
    created_at: draft.created_at || existing?.created_at,
    updated_at: draft.updated_at || existing?.updated_at,
  });

  if (existingIndex >= 0) {
    // Update in place — preserve position
    const updated = [...flows];
    updated[existingIndex] = merged;
    return updated;
  }

  // New flow — add to the beginning
  return [merged, ...flows];
}

export function createLocalFlow(draft: Partial<Flow> = {}): Flow {
  const now = new Date().toISOString();

  return normalizeFlow({
    id: `local-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    name: draft.name || DEFAULT_FLOW_NAME,
    description: draft.description,
    isActive: draft.isActive ?? false,
    nodes: draft.nodes || [],
    edges: draft.edges || [],
    created_at: draft.created_at || now,
    updated_at: draft.updated_at || now,
  });
}

export function listLocalFlows(): Flow[] {
  if (!hasWindow()) return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_FLOWS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Array<Partial<Flow> & Pick<Flow, "id">>;
    return sortFlows(parsed.map((flow) => normalizeFlow(flow)));
  } catch {
    return [];
  }
}

function writeLocalFlows(flows: Flow[]) {
  if (!hasWindow()) return;

  window.localStorage.setItem(
    LOCAL_FLOWS_STORAGE_KEY,
    JSON.stringify(sortFlows(flows))
  );
}

export function upsertLocalFlow(
  draft: FlowDraft
): Flow {
  const nextFlows = upsertFlowInCollection(listLocalFlows(), draft);
  writeLocalFlows(nextFlows);

  return nextFlows.find((flow) => flow.id === draft.id)!;
}

export function deleteLocalFlow(flowId: string) {
  writeLocalFlows(listLocalFlows().filter((flow) => flow.id !== flowId));
}

export function mergeFlowsWithLocalCache(remoteFlows: Flow[]): Flow[] {
  const cachedFlows = listLocalFlows();
  const cachedById = new Map(cachedFlows.map((flow) => [flow.id, flow]));

  const mergedRemoteFlows = remoteFlows.map((remoteFlow) => {
    const cachedFlow = cachedById.get(remoteFlow.id);
    if (!cachedFlow) return normalizeFlow(remoteFlow);

    const remoteTimestamp = new Date(remoteFlow.updated_at).getTime();
    const cachedTimestamp = new Date(cachedFlow.updated_at).getTime();

    if (cachedTimestamp > remoteTimestamp) {
      return normalizeFlow({
        ...remoteFlow,
        ...cachedFlow,
      });
    }

    return normalizeFlow({
      ...remoteFlow,
      isActive: cachedFlow.isActive,
    });
  });

  const localOnlyFlows = cachedFlows.filter(
    (flow) =>
      flow.id.startsWith("local-") &&
      !remoteFlows.some((remoteFlow) => remoteFlow.id === flow.id)
  );

  const mergedFlows = sortFlows([...mergedRemoteFlows, ...localOnlyFlows]);
  writeLocalFlows(mergedFlows);

  return mergedFlows;
}

export function getFlowTriggerLabels(nodes: Array<{ data: NodeData }>): string[] {
  return nodes
    .filter((node) => (node.data as NodeData).type === "trigger")
    .map((node) => describeTrigger(node.data as TriggerNodeData));
}

function describeTrigger(data: TriggerNodeData): string {
  if (data.triggerType === "keyword") {
    return data.keyword?.trim()
      ? `Keyword: "${data.keyword.trim()}"`
      : "Palavra-chave";
  }

  if (data.triggerType === "newContact") {
    return "Novo contato";
  }

  if (data.triggerType === "tag") {
    const scopeLabel = data.audienceScope === "newOnly" ? " (so novos)" : "";
    return data.tagName?.trim()
      ? `Tag: ${data.tagName.trim()}${scopeLabel}`
      : `Tem tag${scopeLabel}`;
  }

  if (data.triggerType === "subscriptionPlan") {
    const scopeLabel = data.audienceScope === "newOnly" ? " (so novos)" : "";
    return data.subscriptionPlan
      ? `Subscription: ${data.subscriptionPlan}${scopeLabel}`
      : `Subscription${scopeLabel}`;
  }

  return "Manual";
}
