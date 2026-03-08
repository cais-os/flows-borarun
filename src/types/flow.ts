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
  TEMPLATE_IMAGE: "templateImage",
  RANDOMIZER: "randomizer",
  WAIT_FOR_REPLY: "waitForReply",
  GENERATE_PDF: "generatePdf",
} as const;

export type NodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];

export type FlowNode = Node<NodeData, string>;
export type FlowEdge = Edge<EdgeData>;

export type EdgeData = {
  label?: string;
  splitPercentage?: number;
  [key: string]: unknown;
};
