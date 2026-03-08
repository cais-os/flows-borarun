export type NodeData =
  | TriggerNodeData
  | SendMessageNodeData
  | TemplateImageNodeData
  | RandomizerNodeData
  | WaitForReplyNodeData
  | GeneratePdfNodeData;

export type CaptureMode = "full" | "summary";
export type ReplyMatchType = "contains" | "exact" | "startsWith" | "any";

export type TriggerNodeData = {
  type: "trigger";
  label: string;
  triggerType: "keyword" | "newContact" | "manual";
  keyword?: string;
  keywordMatch?: "contains" | "notContains" | "exact";
  [key: string]: unknown;
};

export type SendMessageNodeData = {
  type: "sendMessage";
  label: string;
  messageType: "text" | "template" | "image" | "file" | "audio";
  textContent?: string;
  templateId?: string;
  templateName?: string;
  mediaUrl?: string;
  fileName?: string;
  typingSeconds?: number;
  interactiveType?: "none" | "buttons" | "list";
  replyButtons?: WhatsAppReplyButton[];
  listButtonText?: string;
  listSectionTitle?: string;
  listItems?: WhatsAppListItem[];
  [key: string]: unknown;
};

export type TemplateImageNodeData = {
  type: "templateImage";
  label: string;
  templateId?: string;
  templateName?: string;
  headerImageUrl?: string;
  bodyVariables?: Record<string, string>;
  [key: string]: unknown;
};

export type RandomizerNodeData = {
  type: "randomizer";
  label: string;
  splits: RandomizerSplit[];
  [key: string]: unknown;
};

export type WaitForReplyNodeData = {
  type: "waitForReply";
  label: string;
  variableName: string;
  promptMessage?: string;
  captureMode?: CaptureMode;
  aiInstructions?: string;
  routes?: WaitForReplyRoute[];
  noMatchMessage?: string;
  [key: string]: unknown;
};

export type GeneratePdfNodeData = {
  type: "generatePdf";
  label: string;
  templateId: string;
  aiPrompt?: string;
  fileName?: string;
  [key: string]: unknown;
};

export interface RandomizerSplit {
  id: string;
  label: string;
  percentage: number;
}

export interface WhatsAppReplyButton {
  id: string;
  title: string;
}

export interface WhatsAppListItem {
  id: string;
  title: string;
  description?: string;
}

export interface WaitForReplyRoute {
  id: string;
  label: string;
  matchType: ReplyMatchType;
  value?: string;
}
