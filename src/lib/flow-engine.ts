import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flow } from "@/types/flow";
import type {
  NodeData,
  TriggerNodeData,
  SendMessageNodeData,
  RandomizerNodeData,
  WaitForReplyNodeData,
  GeneratePdfNodeData,
} from "@/types/node-data";
import { buildCapturedVariableValue } from "@/lib/captured-variable";
import { generatePdf } from "@/lib/pdf-generator";
import {
  buildNoMatchResponseMessage,
  getMatchedWaitRoute,
  normalizeWaitForReplyNodeData,
} from "@/lib/wait-for-reply";
import {
  sendMetaWhatsAppTextMessage,
  sendMetaWhatsAppAudioMessage,
  sendMetaWhatsAppDocumentMessage,
  sendMetaWhatsAppInteractiveButtonsMessage,
  sendMetaWhatsAppInteractiveListMessage,
  sendTypingIndicator,
} from "@/lib/meta";
import {
  getSendMessageInteractiveType,
  hasWhatsAppListItems,
  hasWhatsAppInteractiveOptions,
  hasWhatsAppReplyButtons,
} from "@/lib/whatsapp";

interface FlowNode {
  id: string;
  data: NodeData;
  [key: string]: unknown;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  [key: string]: unknown;
}

function findNextNodes(
  nodeId: string,
  edges: FlowEdge[],
  nodes: FlowNode[],
  sourceHandle?: string
): FlowNode[] {
  const outEdges = edges.filter(
    (edge) =>
      edge.source === nodeId &&
      (!sourceHandle || edge.sourceHandle === sourceHandle)
  );

  const seen = new Set<string>();
  return outEdges
    .map((edge) => nodes.find((node) => node.id === edge.target))
    .filter((node): node is FlowNode => {
      if (!node || seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
}

function findNextNodesForHandleOrLegacy(
  nodeId: string,
  edges: FlowEdge[],
  nodes: FlowNode[],
  sourceHandle?: string
): FlowNode[] {
  if (sourceHandle) {
    const matchedNodes = findNextNodes(nodeId, edges, nodes, sourceHandle);
    if (matchedNodes.length > 0) return matchedNodes;

    const hasHandledEdges = edges.some(
      (edge) => edge.source === nodeId && !!edge.sourceHandle
    );
    if (hasHandledEdges) return [];
  }

  return findNextNodes(nodeId, edges, nodes);
}

function mergeQueues(...groups: FlowNode[][]): FlowNode[] {
  const seenIds = new Set<string>();
  const merged: FlowNode[] = [];

  for (const group of groups) {
    for (const node of group) {
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);
      merged.push(node);
    }
  }

  return merged;
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

function pickRandomPath(splits: RandomizerNodeData["splits"]): string {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const split of splits) {
    cumulative += split.percentage;
    if (rand <= cumulative) return split.id;
  }

  return splits[splits.length - 1].id;
}

async function getConversationVariables(
  supabase: SupabaseClient,
  conversationId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("conversations")
    .select("flow_variables")
    .eq("id", conversationId)
    .single();

  return (data?.flow_variables as Record<string, string>) || {};
}

async function sendTextAndPersist(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  nodeId: string;
  text: string;
  skipTyping?: boolean;
  inboundMessageId?: string;
}) {
  if (!params.skipTyping && params.inboundMessageId) {
    await sendTypingIndicator(params.inboundMessageId).catch(() => {});
  }
  const result = await sendMetaWhatsAppTextMessage({
    to: params.contactPhone,
    body: params.text,
  });

  await params.supabase.from("messages").insert({
    conversation_id: params.conversationId,
    content: params.text,
    type: "text",
    sender: "bot",
    node_id: params.nodeId,
    wa_message_id: result.messageId,
  });
}

async function sendWaitPrompt(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  nodeId: string;
  data: WaitForReplyNodeData;
  inboundMessageId?: string;
}) {
  if (!params.data.promptMessage) return;

  const variables = await getConversationVariables(
    params.supabase,
    params.conversationId
  );
  const interpolated = interpolateVariables(params.data.promptMessage, variables);

  try {
    await sendTextAndPersist({
      supabase: params.supabase,
      conversationId: params.conversationId,
      contactPhone: params.contactPhone,
      nodeId: params.nodeId,
      text: interpolated,
      inboundMessageId: params.inboundMessageId,
    });
  } catch (error) {
    console.error("Flow engine: failed to send prompt message", error);
  }
}

async function pauseFlow(params: {
  supabase: SupabaseClient;
  conversationId: string;
  currentNodeId: string;
  queue: FlowNode[];
}) {
  await params.supabase
    .from("conversations")
    .update({
      status: "paused",
      current_node_id: params.currentNodeId,
      flow_node_queue: params.queue.map((node) => node.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.conversationId);
}

async function completeFlow(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase
    .from("conversations")
    .update({
      active_flow_id: null,
      flow_node_queue: null,
      current_node_id: null,
      status: "ai",
      ai_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

async function applyTypingDelay(
  inboundMessageId: string | undefined,
  typingSeconds: number | undefined
) {
  const seconds = Math.max(0, Math.min(30, typingSeconds || 0));

  if (inboundMessageId) {
    await sendTypingIndicator(inboundMessageId).catch(() => {});
  }

  if (seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

async function executeSendMessageNode(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  node: FlowNode;
  data: SendMessageNodeData;
  inboundMessageId?: string;
}) {
  const flowVariables = await getConversationVariables(
    params.supabase,
    params.conversationId
  );
  const text = params.data.textContent
    ? interpolateVariables(params.data.textContent, flowVariables)
    : "";
  const interactiveType = getSendMessageInteractiveType(params.data);
  const typingSeconds = params.data.typingSeconds;

  if (
    params.data.messageType === "text" &&
    interactiveType === "buttons" &&
    hasWhatsAppReplyButtons(params.data) &&
    text
  ) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds);
      const result = await sendMetaWhatsAppInteractiveButtonsMessage({
        to: params.contactPhone,
        body: text,
        replyButtons: params.data.replyButtons || [],
      });

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: text,
        type: "text",
        sender: "bot",
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send interactive buttons", error);
    }
  } else if (
    params.data.messageType === "text" &&
    interactiveType === "list" &&
    hasWhatsAppListItems(params.data) &&
    text
  ) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds);
      const result = await sendMetaWhatsAppInteractiveListMessage({
        to: params.contactPhone,
        body: text,
        buttonText: params.data.listButtonText || "Ver opcoes",
        sectionTitle: params.data.listSectionTitle || "Opcoes",
        items: params.data.listItems || [],
      });

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: text,
        type: "text",
        sender: "bot",
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send interactive list", error);
    }
  } else if (text && params.data.messageType === "text") {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds);
      await sendTextAndPersist({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        nodeId: params.node.id,
        text,
        skipTyping: true,
      });
    } catch (error) {
      console.error("Flow engine: failed to send message", error);
    }
  }

  if (params.data.messageType === "audio" && params.data.mediaUrl) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds);
      const result = await sendMetaWhatsAppAudioMessage({
        to: params.contactPhone,
        audioUrl: params.data.mediaUrl,
      });

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: params.data.fileName || "Audio",
        type: "audio",
        sender: "bot",
        media_url: params.data.mediaUrl,
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send audio", error);
    }
  }

  if (params.data.messageType === "file" && params.data.mediaUrl) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds);
      const result = await sendMetaWhatsAppDocumentMessage({
        to: params.contactPhone,
        documentUrl: params.data.mediaUrl,
        fileName: params.data.fileName,
      });

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: params.data.fileName || "Documento",
        type: "file",
        sender: "bot",
        media_url: params.data.mediaUrl,
        file_name: params.data.fileName,
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send document", error);
    }
  }
}

async function executeGeneratePdfNode(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  node: FlowNode;
  data: GeneratePdfNodeData;
  inboundMessageId?: string;
}) {
  try {
    const flowVariables = await getConversationVariables(
      params.supabase,
      params.conversationId
    );

    const { data: template } = await params.supabase
      .from("pdf_templates")
      .select("html_content")
      .eq("id", params.data.templateId)
      .single();

    if (!template) return;

    const pdfBuffer = await generatePdf({
      templateHtml: template.html_content,
      flowVariables,
      aiPrompt: params.data.aiPrompt,
    });

    const fileName = `${params.conversationId}-${Date.now()}.pdf`;
    await params.supabase.storage
      .from("pdfs")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf" });

    const { data: urlData } = params.supabase.storage
      .from("pdfs")
      .getPublicUrl(fileName);

    if (params.inboundMessageId) {
      await sendTypingIndicator(params.inboundMessageId).catch(() => {});
    }
    const result = await sendMetaWhatsAppDocumentMessage({
      to: params.contactPhone,
      documentUrl: urlData.publicUrl,
      fileName: params.data.fileName || "plano-de-treino.pdf",
    });

    await params.supabase.from("messages").insert({
      conversation_id: params.conversationId,
      content: params.data.fileName || "plano-de-treino.pdf",
      type: "file",
      sender: "bot",
      media_url: urlData.publicUrl,
      file_name: params.data.fileName || "plano-de-treino.pdf",
      node_id: params.node.id,
      wa_message_id: result.messageId,
    });
  } catch (error) {
    console.error("Flow engine: failed to generate PDF", error);
  }
}

async function runFlowQueue(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  initialQueue: FlowNode[];
  inboundMessageId?: string;
}) {
  const queue = [...params.initialQueue];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const data = current.data;

    if (data.type === "trigger") {
      queue.push(...findNextNodes(current.id, params.edges, params.nodes));
      continue;
    }

    if (data.type === "randomizer") {
      const randomizerData = data as RandomizerNodeData;
      const chosenSplitId = pickRandomPath(randomizerData.splits);
      queue.push(
        ...findNextNodes(current.id, params.edges, params.nodes, chosenSplitId)
      );
      continue;
    }

    if (data.type === "waitForReply") {
      const waitData = normalizeWaitForReplyNodeData(
        data as WaitForReplyNodeData
      );

      await sendWaitPrompt({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        nodeId: current.id,
        data: waitData,
        inboundMessageId: params.inboundMessageId,
      });

      await pauseFlow({
        supabase: params.supabase,
        conversationId: params.conversationId,
        currentNodeId: current.id,
        queue,
      });
      return "paused" as const;
    }

    if (data.type === "sendMessage") {
      const sendData = data as SendMessageNodeData;

      await executeSendMessageNode({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        node: current,
        data: sendData,
        inboundMessageId: params.inboundMessageId,
      });

      // Interactive options (list/buttons): only pause if user's choice
      // determines the path (multiple unique next nodes). If all options
      // lead to the same node, let it flow — the next node (typically
      // waitForReply) will capture the user's selection.
      if (hasWhatsAppInteractiveOptions(sendData)) {
        const nextNodes = findNextNodes(current.id, params.edges, params.nodes);
        if (nextNodes.length > 1) {
          await pauseFlow({
            supabase: params.supabase,
            conversationId: params.conversationId,
            currentNodeId: current.id,
            queue,
          });
          return "paused" as const;
        }
      }
      // Non-interactive or single-path interactive → continues automatically
    }

    if (data.type === "generatePdf") {
      await executeGeneratePdfNode({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        node: current,
        data: data as GeneratePdfNodeData,
        inboundMessageId: params.inboundMessageId,
      });
    }

    queue.push(...findNextNodes(current.id, params.edges, params.nodes));
  }

  await completeFlow(params.supabase, params.conversationId);
  return "completed" as const;
}

/**
 * Check if a message matches any active flow trigger.
 * Returns the matched flow and trigger node, or null.
 */
export async function findMatchingFlow(
  supabase: SupabaseClient,
  messageText: string,
  isNewContact: boolean
): Promise<{ flow: Flow; triggerNode: FlowNode } | null> {
  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("is_active", true);

  if (!flows || flows.length === 0) return null;

  const normalizedText = messageText.trim().toLowerCase();

  for (const flow of flows as Flow[]) {
    const nodes = flow.nodes as unknown as FlowNode[];

    for (const node of nodes) {
      const data = node.data;
      if (data.type !== "trigger") continue;

      const triggerData = data as TriggerNodeData;

      if (triggerData.triggerType === "keyword" && triggerData.keyword) {
        const keywords = triggerData.keyword
          .split(",")
          .map((keyword) => keyword.trim().toLowerCase());
        const matchType = triggerData.keywordMatch || "contains";

        let matched = false;
        if (matchType === "contains") {
          matched = keywords.some((keyword) => normalizedText.includes(keyword));
        } else if (matchType === "notContains") {
          matched = keywords.every(
            (keyword) => !normalizedText.includes(keyword)
          );
        } else if (matchType === "exact") {
          matched = keywords.some((keyword) => normalizedText === keyword);
        }

        if (matched) {
          return { flow, triggerNode: node };
        }
      }

      if (triggerData.triggerType === "newContact" && isNewContact) {
        return { flow, triggerNode: node };
      }
    }
  }

  return null;
}

/**
 * Execute a flow starting from a trigger node.
 * Sends real WhatsApp messages and saves them to the database.
 */
export async function executeFlow(
  supabase: SupabaseClient,
  conversationId: string,
  contactPhone: string,
  flow: Flow,
  triggerNode: FlowNode,
  inboundMessageId?: string
): Promise<void> {
  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];

  await supabase
    .from("conversations")
    .update({
      active_flow_id: flow.id,
      status: "running",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  await runFlowQueue({
    supabase,
    conversationId,
    contactPhone,
    nodes,
    edges,
    initialQueue: findNextNodes(triggerNode.id, edges, nodes),
    inboundMessageId,
  });
}

export type ResumeFlowResult =
  | { status: "ignored" }
  | { status: "waiting" }
  | { status: "resumed" };

/**
 * Resume a paused flow after the user replies.
 * Saves the user's answer as a flow variable and continues execution.
 */
export async function resumeFlow(
  supabase: SupabaseClient,
  conversationId: string,
  contactPhone: string,
  userAnswer: string,
  options?: { selectedHandleId?: string | null; inboundMessageId?: string }
): Promise<ResumeFlowResult> {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("active_flow_id, current_node_id, flow_node_queue, flow_variables")
    .eq("id", conversationId)
    .single();

  if (!conversation?.active_flow_id || !conversation?.current_node_id) {
    return { status: "ignored" };
  }

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", conversation.active_flow_id)
    .single();

  if (!flow) return { status: "ignored" };

  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];
  const currentNode = nodes.find(
    (node) => node.id === conversation.current_node_id
  );

  if (!currentNode) return { status: "ignored" };

  const variables =
    (conversation.flow_variables as Record<string, string>) || {};

  let nextFromCurrent: FlowNode[] = findNextNodes(
    currentNode.id,
    edges,
    nodes
  );

  if (currentNode.data.type === "waitForReply") {
    const rawWaitData = currentNode.data as WaitForReplyNodeData;
    const waitData = normalizeWaitForReplyNodeData(rawWaitData);
    const matchedRoute = getMatchedWaitRoute(waitData, userAnswer);

    if (rawWaitData.routes && rawWaitData.routes.length > 0 && !matchedRoute) {
      const message = buildNoMatchResponseMessage(waitData);
      if (message) {
        const interpolated = interpolateVariables(message, variables);
        try {
          await sendTextAndPersist({
            supabase,
            conversationId,
            contactPhone,
            nodeId: currentNode.id,
            text: interpolated,
            inboundMessageId: options?.inboundMessageId,
          });
        } catch (error) {
          console.error("Flow engine: failed to send no-match message", error);
        }
      }

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return { status: "waiting" };
    }

    if (matchedRoute && waitData.variableName) {
      variables[waitData.variableName] = await buildCapturedVariableValue(
        waitData,
        userAnswer
      );
    }

    nextFromCurrent = findNextNodesForHandleOrLegacy(
      currentNode.id,
      edges,
      nodes,
      matchedRoute?.id
    );
  } else if (currentNode.data.type === "sendMessage") {
    const sendData = currentNode.data as SendMessageNodeData;
    const interactiveType = getSendMessageInteractiveType(sendData);
    const hasInteractiveOptions = hasWhatsAppInteractiveOptions(sendData);

    if (hasInteractiveOptions && !options?.selectedHandleId) {
      const promptText =
        interactiveType === "list"
          ? "Escolha um item da lista para continuar o flow."
          : "Escolha uma das opcoes acima para continuar o flow.";

      try {
        await sendTextAndPersist({
          supabase,
          conversationId,
          contactPhone,
          nodeId: currentNode.id,
          text: promptText,
          inboundMessageId: options?.inboundMessageId,
        });
      } catch (error) {
        console.error("Flow engine: failed to re-prompt interactive choice", error);
      }

      await pauseFlow({
        supabase,
        conversationId,
        currentNodeId: currentNode.id,
        queue: ((conversation.flow_node_queue as string[]) || [])
          .map((id) => nodes.find((node) => node.id === id))
          .filter(Boolean) as FlowNode[],
      });

      return { status: "waiting" };
    }

    nextFromCurrent = findNextNodesForHandleOrLegacy(
      currentNode.id,
      edges,
      nodes,
      options?.selectedHandleId || undefined
    );
  }

  await supabase
    .from("conversations")
    .update({
      flow_variables: variables,
      status: "running",
      current_node_id: null,
      flow_node_queue: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  const queueFromIds = ((conversation.flow_node_queue as string[]) || [])
    .map((id) => nodes.find((node) => node.id === id))
    .filter(Boolean) as FlowNode[];

  const mergedQueue = mergeQueues(nextFromCurrent, queueFromIds);

  if (mergedQueue.length === 0) {
    await completeFlow(supabase, conversationId);
    return { status: "resumed" };
  }

  await runFlowQueue({
    supabase,
    conversationId,
    contactPhone,
    nodes,
    edges,
    initialQueue: mergedQueue,
    inboundMessageId: options?.inboundMessageId,
  });

  return { status: "resumed" };
}
