import type { WhatsAppReplyButton } from "./node-data";

export interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  messages: ChatMessage[];
  status: "running" | "paused" | "completed" | "human";
  currentNodeId: string | null;
  pendingNodeIds: string[];
  flowVariables: Record<string, string>;
  abTestPath?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: "text" | "image" | "file" | "audio" | "video" | "template" | "system";
  sender: "bot" | "contact" | "human" | "system";
  mediaUrl?: string;
  fileName?: string;
  templateName?: string;
  nodeId?: string;
  replyButtons?: WhatsAppReplyButton[];
  interactiveType?: "buttons" | "list";
  timestamp: Date;
}

export type SimulationStatus = "idle" | "running" | "paused" | "completed";

export type ActiveTab =
  | "flows"
  | "conversations"
  | "campanhas"
  | "integrations"
  | "analytics"
  | "settings";
