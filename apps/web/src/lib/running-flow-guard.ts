export type RunningFlowWebhookAction =
  | "ignore"
  | "skip_processing"
  | "continue_stale"
  | "reset_stale";

function getQueueIds(flowNodeQueue: unknown) {
  return Array.isArray(flowNodeQueue)
    ? flowNodeQueue.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
    : [];
}

export function hasRunningFlowCheckpoint(params: {
  currentNodeId?: string | null;
  flowNodeQueue: unknown;
}) {
  return (
    (typeof params.currentNodeId === "string" &&
      params.currentNodeId.length > 0) ||
    getQueueIds(params.flowNodeQueue).length > 0
  );
}

export function getRunningFlowWebhookAction(params: {
  status?: string | null;
  activeFlowId?: string | null;
  currentNodeId?: string | null;
  flowNodeQueue: unknown;
  updatedAt?: string | null;
  now?: Date;
  stalenessMs?: number;
}): RunningFlowWebhookAction {
  if (params.status !== "running" || !params.activeFlowId) {
    return "ignore";
  }

  const now = params.now || new Date();
  const stalenessMs = params.stalenessMs ?? 2 * 60 * 1000;
  const updatedAtMs = params.updatedAt
    ? new Date(params.updatedAt).getTime()
    : Number.NaN;
  const isFresh =
    !Number.isNaN(updatedAtMs) && now.getTime() - updatedAtMs < stalenessMs;

  if (isFresh) {
    return "skip_processing";
  }

  if (
    hasRunningFlowCheckpoint({
      currentNodeId: params.currentNodeId,
      flowNodeQueue: params.flowNodeQueue,
    })
  ) {
    return "continue_stale";
  }

  return "reset_stale";
}
