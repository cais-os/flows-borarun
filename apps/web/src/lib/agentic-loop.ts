export const AGENTIC_LOOP_ACTIVE_NODE_ID_KEY =
  "__agentic_loop_active_node_id";
export const AGENTIC_LOOP_PAYMENT_NODE_ID_KEY =
  "__agentic_loop_payment_node_id";
export const AGENTIC_LOOP_SALES_MODE_KEY = "__agentic_loop_sales_mode";

export function clearAgenticLoopState(
  variables: Record<string, string> | null | undefined
) {
  const next = { ...(variables || {}) };

  delete next[AGENTIC_LOOP_ACTIVE_NODE_ID_KEY];
  delete next[AGENTIC_LOOP_PAYMENT_NODE_ID_KEY];
  delete next[AGENTIC_LOOP_SALES_MODE_KEY];

  return next;
}

export function isAgenticLoopSalesModeActive(
  variables: Record<string, string> | null | undefined
) {
  return variables?.[AGENTIC_LOOP_SALES_MODE_KEY] === "true";
}
