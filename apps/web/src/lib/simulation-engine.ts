import type { Node, Edge } from "@xyflow/react";
import type {
  NodeData,
  SendMessageNodeData,
  TagConversationNodeData,
  RandomizerNodeData,
  WaitForReplyNodeData,
  AgenticLoopNodeData,
} from "@/types/node-data";
import type { ChatMessage } from "@/types/simulator";
import {
  getSendMessageInteractiveOptions,
  getSendMessageInteractiveType,
  hasWhatsAppInteractiveOptions,
} from "./whatsapp";
import {
  buildNoMatchResponseMessage,
  getMatchedWaitRoute,
  normalizeWaitForReplyNodeData,
  summarizeCapturedValueLocally,
} from "./wait-for-reply";

interface PauseState {
  nodeId: string;
  pendingNodeIds: string[];
}

interface SimulationCallbacks {
  onMessage: (message: ChatMessage) => void;
  onNodeChange: (nodeId: string) => void;
  onComplete: () => void;
  onPause?: (state: PauseState) => void;
  shouldStop: () => boolean;
  isHumanMode: () => boolean;
  getFlowVariables: () => Record<string, string>;
}

interface ResumeWaitNodeResult {
  status: "waiting" | "ready";
  nextNodes: Node<NodeData>[];
  flowVariables: Record<string, string>;
  message?: ChatMessage;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandomPath(splits: RandomizerNodeData["splits"]): string {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const split of splits) {
    cumulative += split.percentage;
    if (rand <= cumulative) return split.id;
  }
  return splits[splits.length - 1].id;
}

function interpolateVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => variables[key] || `{{${key}}}`
  );
}

function findTriggerNode(nodes: Node<NodeData>[]): Node<NodeData> | undefined {
  return nodes.find((node) => (node.data as NodeData).type === "trigger");
}

function findNextNodes(
  nodeId: string,
  edges: Edge[],
  nodes: Node<NodeData>[],
  sourceHandle?: string
): Node<NodeData>[] {
  const outEdges = edges.filter(
    (edge) =>
      edge.source === nodeId &&
      (!sourceHandle || edge.sourceHandle === sourceHandle)
  );

  return outEdges
    .map((edge) => nodes.find((node) => node.id === edge.target))
    .filter(Boolean) as Node<NodeData>[];
}

function findNextNodesForHandleOrLegacy(
  nodeId: string,
  edges: Edge[],
  nodes: Node<NodeData>[],
  sourceHandle?: string
): Node<NodeData>[] {
  if (sourceHandle) {
    const handled = findNextNodes(nodeId, edges, nodes, sourceHandle);
    if (handled.length > 0) return handled;

    const hasHandledEdges = edges.some(
      (edge) => edge.source === nodeId && !!edge.sourceHandle
    );
    if (hasHandledEdges) return [];
  }

  return findNextNodes(nodeId, edges, nodes);
}

function mergeQueues(groups: Node<NodeData>[][]): Node<NodeData>[] {
  const seenIds = new Set<string>();
  const merged: Node<NodeData>[] = [];

  for (const group of groups) {
    for (const node of group) {
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);
      merged.push(node);
    }
  }

  return merged;
}

export function findNextNodesForReplyButton(
  nodeId: string,
  buttonId: string,
  edges: Edge[],
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  return findNextNodesForHandleOrLegacy(nodeId, edges, nodes, buttonId);
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function nodeToMessage(
  node: Node<NodeData>,
  variables: Record<string, string>
): ChatMessage | null {
  const data = node.data as NodeData;

  if (data.type === "sendMessage") {
    const sendData = data as SendMessageNodeData;
    const interactiveType = getSendMessageInteractiveType(sendData);
    const interactiveOptions = getSendMessageInteractiveOptions(sendData);
    return {
      id: createMessageId("msg"),
      content: sendData.messageType === "ai"
        ? `[IA] ${interpolateVariables(sendData.aiPrompt || "Prompt nao configurado", variables)}`
        : interpolateVariables(
            sendData.textContent ||
              sendData.templateName ||
              sendData.fileName ||
              "Mensagem configurada",
            variables
          ),
      type: sendData.messageType === "template" ? "template" : sendData.messageType === "ai" ? "text" : sendData.messageType,
      sender: "bot",
      mediaUrl: sendData.mediaUrl,
      fileName: sendData.fileName,
      templateName: sendData.templateName,
      nodeId: node.id,
      replyButtons:
        interactiveType !== "none"
          ? interactiveOptions.map((option) => ({
              id: option.id,
              title: option.title,
            }))
          : undefined,
      interactiveType: interactiveType === "none" ? undefined : interactiveType,
      timestamp: new Date(),
    };
  }

  return null;
}

async function processSimulationQueue(
  initialQueue: Node<NodeData>[],
  nodes: Node<NodeData>[],
  edges: Edge[],
  callbacks: SimulationCallbacks
): Promise<void> {
  const queue: Node<NodeData>[] = [...initialQueue];

  while (queue.length > 0) {
    if (callbacks.shouldStop()) return;

    while (callbacks.isHumanMode()) {
      await delay(500);
      if (callbacks.shouldStop()) return;
    }

    const current = queue.shift()!;
    const data = current.data as NodeData;

    callbacks.onNodeChange(current.id);
    await delay(800);

    if (data.type === "trigger") {
      queue.push(...findNextNodes(current.id, edges, nodes));
      continue;
    }

    if (data.type === "randomizer") {
      const randomizerData = data as RandomizerNodeData;
      const chosenSplitId = pickRandomPath(randomizerData.splits);
      const chosenSplit = randomizerData.splits.find(
        (split) => split.id === chosenSplitId
      );

      callbacks.onMessage({
        id: createMessageId("sys"),
        content: `Teste A/B: sorteou "${chosenSplit?.label || chosenSplitId}" (${chosenSplit?.percentage}%)`,
        type: "system",
        sender: "system",
        timestamp: new Date(),
      });

      queue.push(...findNextNodes(current.id, edges, nodes, chosenSplitId));
      await delay(500);
      continue;
    }

    if (data.type === "waitForReply") {
      const waitData = normalizeWaitForReplyNodeData(
        data as WaitForReplyNodeData
      );

      if (waitData.promptMessage) {
        callbacks.onMessage({
          id: createMessageId("msg"),
          content: interpolateVariables(
            waitData.promptMessage,
            callbacks.getFlowVariables()
          ),
          type: "text",
          sender: "bot",
          nodeId: current.id,
          timestamp: new Date(),
        });
      }

      callbacks.onPause?.({
        nodeId: current.id,
        pendingNodeIds: queue.map((node) => node.id),
      });
      return;
    }

    if (data.type === "agenticLoop") {
      const loopData = data as AgenticLoopNodeData;

      callbacks.onMessage({
        id: createMessageId("sys"),
        content: `Agente IA pausado (${loopData.model || "gpt-4o"}, ${loopData.handoffTargets?.length ?? 0} handoffs)`,
        type: "system",
        sender: "system",
        timestamp: new Date(),
      });

      callbacks.onPause?.({
        nodeId: current.id,
        pendingNodeIds: queue.map((node) => node.id),
      });
      return;
    }

    if (data.type === "finishFlow") {
      callbacks.onMessage({
        id: createMessageId("sys"),
        content: `${data.label || "Finalizar Flow"} executado`,
        type: "system",
        sender: "system",
        timestamp: new Date(),
      });
      callbacks.onComplete();
      return;
    }

    if (data.type === "tagConversation") {
      const tagData = data as TagConversationNodeData;
      callbacks.onMessage({
        id: createMessageId("sys"),
        content: tagData.tagName
          ? `Tag aplicada: ${tagData.tagName}`
          : "No Taguear executado sem tag selecionada",
        type: "system",
        sender: "system",
        timestamp: new Date(),
      });
      queue.push(...findNextNodes(current.id, edges, nodes));
      await delay(350);
      continue;
    }

    const message = nodeToMessage(current, callbacks.getFlowVariables());
    if (message) {
      callbacks.onMessage(message);

      if (
        data.type === "sendMessage" &&
        hasWhatsAppInteractiveOptions(data as SendMessageNodeData)
      ) {
        callbacks.onPause?.({
          nodeId: current.id,
          pendingNodeIds: queue.map((node) => node.id),
        });
        return;
      }

      await delay(1000 + Math.random() * 500);
    }

    queue.push(...findNextNodes(current.id, edges, nodes));
  }

  callbacks.onMessage({
    id: createMessageId("sys"),
    content: "Conversa concluida",
    type: "system",
    sender: "system",
    timestamp: new Date(),
  });
  callbacks.onComplete();
}

function buildSimulationCapturedValue(
  data: WaitForReplyNodeData,
  userAnswer: string
): string {
  if ((data.captureMode || "full") === "summary") {
    return summarizeCapturedValueLocally(userAnswer);
  }

  return userAnswer.trim();
}

export function resolveWaitForReplyInSimulation(params: {
  currentNodeId: string;
  userAnswer: string;
  pendingNodeIds: string[];
  flowVariables: Record<string, string>;
  nodes: Node<NodeData>[];
  edges: Edge[];
}): ResumeWaitNodeResult {
  const currentNode = params.nodes.find((node) => node.id === params.currentNodeId);
  if (!currentNode || currentNode.data.type !== "waitForReply") {
    return {
      status: "ready",
      nextNodes: [],
      flowVariables: params.flowVariables,
    };
  }

  const rawData = currentNode.data as WaitForReplyNodeData;
  const data = normalizeWaitForReplyNodeData(rawData);
  const matchedRoute = getMatchedWaitRoute(data, params.userAnswer);

  if (rawData.routes && rawData.routes.length > 0 && !matchedRoute) {
    const noMatchMessage = buildNoMatchResponseMessage(data);
    return {
      status: "waiting",
      nextNodes: [],
      flowVariables: params.flowVariables,
      message: noMatchMessage
        ? {
            id: createMessageId("msg"),
            content: interpolateVariables(noMatchMessage, params.flowVariables),
            type: "text",
            sender: "bot",
            nodeId: currentNode.id,
            timestamp: new Date(),
          }
        : undefined,
    };
  }

  const nextVariables = { ...params.flowVariables };
  if (data.variableName) {
    nextVariables[data.variableName] = buildSimulationCapturedValue(
      data,
      params.userAnswer
    );
  }

  const nextFromCurrent = findNextNodesForHandleOrLegacy(
    currentNode.id,
    params.edges,
    params.nodes,
    matchedRoute?.id
  );

  const pendingNodes = params.pendingNodeIds
    .map((id) => params.nodes.find((node) => node.id === id))
    .filter(Boolean) as Node<NodeData>[];

  return {
    status: "ready",
    nextNodes: mergeQueues([nextFromCurrent, pendingNodes]),
    flowVariables: nextVariables,
  };
}

export async function runSimulation(
  nodes: Node<NodeData>[],
  edges: Edge[],
  callbacks: SimulationCallbacks
): Promise<void> {
  const trigger = findTriggerNode(nodes);
  if (!trigger) {
    callbacks.onMessage({
      id: createMessageId("sys"),
      content: "Nenhum no Trigger encontrado no flow",
      type: "system",
      sender: "system",
      timestamp: new Date(),
    });
    callbacks.onComplete();
    return;
  }

  callbacks.onMessage({
    id: createMessageId("sys"),
    content: "Conversa iniciada",
    type: "system",
    sender: "system",
    timestamp: new Date(),
  });

  await processSimulationQueue([trigger], nodes, edges, callbacks);
}

export async function continueSimulation(
  nextNodes: Node<NodeData>[],
  nodes: Node<NodeData>[],
  edges: Edge[],
  callbacks: SimulationCallbacks
): Promise<void> {
  await processSimulationQueue(nextNodes, nodes, edges, callbacks);
}
