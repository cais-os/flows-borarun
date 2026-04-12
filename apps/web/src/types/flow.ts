import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./node-data";

export interface Flow {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  created_at: string;
  updated_at: string;
}

export const NODE_TYPES = {
  TRIGGER: "trigger",
  SEND_MESSAGE: "sendMessage",
  TAG_CONVERSATION: "tagConversation",
  RANDOMIZER: "randomizer",
  WAIT_FOR_REPLY: "waitForReply",
  GENERATE_PDF: "generatePdf",
  WAIT_TIMER: "waitTimer",
  FINISH_FLOW: "finishFlow",
  AI_COLLECTOR: "aiCollector",
  STRAVA_CONNECT: "stravaConnect",
  PAYMENT: "payment",
  WHATSAPP_FLOW: "whatsappFlow",
  WAIT_FOR_PLAYED: "waitForPlayed",
} as const;

export type NodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];

export type FlowNode = Node<NodeData, string>;
export type FlowEdge = Edge<EdgeData>;

export type EdgeData = {
  label?: string;
  splitPercentage?: number;
  [key: string]: unknown;
};
