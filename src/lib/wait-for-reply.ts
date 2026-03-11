import type {
  CaptureMode,
  ReplyMatchType,
  WaitForReplyNodeData,
  WaitForReplyRoute,
} from "@/types/node-data";
import type { FlowEdge, FlowNode } from "@/types/flow";

export const DEFAULT_WAIT_ROUTE_LABEL = "Qualquer resposta";
export const LEGACY_WAIT_ROUTE_ID = "route-any-default";

function createRouteId() {
  return `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWaitForReplyRoute(
  matchType: ReplyMatchType = "contains"
): WaitForReplyRoute {
  if (matchType === "any") {
    return {
      id: createRouteId(),
      label: DEFAULT_WAIT_ROUTE_LABEL,
      matchType: "any",
      value: "",
    };
  }

  return {
    id: createRouteId(),
    label: "Nova regra",
    matchType,
    value: "",
  };
}

export function createDefaultWaitRoutes(): WaitForReplyRoute[] {
  return [
    {
      id: LEGACY_WAIT_ROUTE_ID,
      label: DEFAULT_WAIT_ROUTE_LABEL,
      matchType: "any",
      value: "",
    },
  ];
}

export function normalizeWaitForReplyNodeData(
  data: WaitForReplyNodeData
): WaitForReplyNodeData {
  const routes =
    data.routes && data.routes.length > 0
      ? data.routes.map((route) => ({
          ...route,
          label:
            route.matchType === "any"
              ? route.label || DEFAULT_WAIT_ROUTE_LABEL
              : route.label || "Nova regra",
          value: route.value || "",
        }))
      : createDefaultWaitRoutes();

  return {
    ...data,
    label: data.label || "Capturar Resposta",
    captureMode: (data.captureMode as CaptureMode | undefined) || "full",
    variableDescription: data.variableDescription || "",
    routes: ensureAnyRoutesLast(routes),
    aiInstructions: data.aiInstructions || "",
    noMatchMessage: data.noMatchMessage || "",
  };
}

export function ensureAnyRoutesLast(
  routes: WaitForReplyRoute[]
): WaitForReplyRoute[] {
  const specificRoutes = routes.filter((route) => route.matchType !== "any");
  const anyRoutes = routes.filter((route) => route.matchType === "any");
  return [...specificRoutes, ...anyRoutes];
}

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function splitRuleTerms(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function doesRouteMatch(
  route: WaitForReplyRoute,
  userAnswer: string
): boolean {
  if (route.matchType === "any") return true;

  const normalizedAnswer = normalizeText(userAnswer);
  const terms = splitRuleTerms(route.value || "").map(normalizeText);
  if (terms.length === 0) return false;

  if (route.matchType === "contains") {
    return terms.some((term) => normalizedAnswer.includes(term));
  }

  if (route.matchType === "startsWith") {
    return terms.some((term) => normalizedAnswer.startsWith(term));
  }

  return terms.some((term) => normalizedAnswer === term);
}

export function getMatchedWaitRoute(
  data: WaitForReplyNodeData,
  userAnswer: string
): WaitForReplyRoute | null {
  const routes = ensureAnyRoutesLast(
    (data.routes && data.routes.length > 0
      ? data.routes
      : createDefaultWaitRoutes()
    ).map((route) => ({
      ...route,
      value: route.value || "",
    }))
  );

  for (const route of routes) {
    if (route.matchType === "any") continue;
    if (doesRouteMatch(route, userAnswer)) return route;
  }

  return routes.find((route) => route.matchType === "any") || null;
}

export function getWaitForReplySourceHandles(
  data: WaitForReplyNodeData
): { id: string; label: string }[] {
  const routes = normalizeWaitForReplyNodeData(data).routes || [];
  return routes.map((route) => ({
    id: route.id,
    label:
      route.matchType === "any"
        ? route.label || DEFAULT_WAIT_ROUTE_LABEL
        : route.label || "Nova regra",
  }));
}

export function normalizeWaitForReplyFlow(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const normalizedNodes = nodes.map((node) => {
    if (node.data.type !== "waitForReply") return node;

    return {
      ...node,
      data: normalizeWaitForReplyNodeData(node.data),
    };
  });

  const waitNodeMap = new Map(
    normalizedNodes
      .filter((node) => node.data.type === "waitForReply")
      .map((node) => [node.id, node.data as WaitForReplyNodeData])
  );

  const normalizedEdges = edges.map((edge) => {
    const waitData = waitNodeMap.get(edge.source);
    if (!waitData) return edge;

    if (edge.sourceHandle) return edge;

    const defaultRouteId =
      waitData.routes?.find((route) => route.matchType === "any")?.id ||
      waitData.routes?.[0]?.id ||
      LEGACY_WAIT_ROUTE_ID;
    return {
      ...edge,
      sourceHandle: defaultRouteId,
    };
  });

  return { nodes: normalizedNodes, edges: normalizedEdges };
}

export function buildNoMatchResponseMessage(
  data: WaitForReplyNodeData
): string | null {
  const message = data.noMatchMessage?.trim();
  if (message) return message;

  const prompt = data.promptMessage?.trim();
  if (!prompt) return null;

  return `Nao consegui encaixar sua resposta nas regras. ${prompt}`;
}

export function summarizeCapturedValueLocally(userAnswer: string): string {
  const compact = userAnswer.replace(/\s+/g, " ").trim();
  if (compact.length <= 120) return compact;

  const firstSentence = compact.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length >= 20) {
    return `${firstSentence.slice(0, 117).trim()}...`;
  }

  return `${compact.slice(0, 117).trim()}...`;
}
