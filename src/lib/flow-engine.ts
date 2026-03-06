import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flow } from "@/types/flow";
import type {
  NodeData,
  TriggerNodeData,
  SendMessageNodeData,
  RandomizerNodeData,
} from "@/types/node-data";
import { sendMetaWhatsAppTextMessage } from "@/lib/meta";

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
    (e) =>
      e.source === nodeId &&
      (!sourceHandle || e.sourceHandle === sourceHandle)
  );
  return outEdges
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter(Boolean) as FlowNode[];
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
          .map((k) => k.trim().toLowerCase());
        if (keywords.some((kw) => normalizedText.includes(kw))) {
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
  triggerNode: FlowNode
): Promise<void> {
  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];

  // Mark conversation as running this flow
  await supabase
    .from("conversations")
    .update({
      active_flow_id: flow.id,
      status: "running",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  const queue = findNextNodes(triggerNode.id, edges, nodes);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const data = current.data;

    if (data.type === "trigger") {
      queue.push(...findNextNodes(current.id, edges, nodes));
      continue;
    }

    if (data.type === "randomizer") {
      const rd = data as RandomizerNodeData;
      const chosenSplitId = pickRandomPath(rd.splits);
      queue.push(...findNextNodes(current.id, edges, nodes, chosenSplitId));
      continue;
    }

    if (data.type === "sendMessage") {
      const d = data as SendMessageNodeData;
      const text = d.textContent || "";

      if (text && d.messageType === "text") {
        try {
          const result = await sendMetaWhatsAppTextMessage({
            to: contactPhone,
            body: text,
          });

          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: text,
            type: "text",
            sender: "bot",
            node_id: current.id,
            wa_message_id: result.messageId,
          });
        } catch (error) {
          console.error("Flow engine: failed to send message", error);
        }
      }

      // If node has reply buttons, pause and wait for user reply
      if (d.replyButtons && d.replyButtons.length > 0) {
        await supabase
          .from("conversations")
          .update({
            status: "paused",
            current_node_id: current.id,
            flow_node_queue: queue.map((n) => n.id),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
        return; // Stop execution, will resume when user replies
      }
    }

    // TODO: handle templateImage type

    queue.push(...findNextNodes(current.id, edges, nodes));
  }

  // Flow completed — enable AI
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
