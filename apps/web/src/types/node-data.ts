export type NodeData =
  | TriggerNodeData
  | SendMessageNodeData
  | TagConversationNodeData
  | RandomizerNodeData
  | WaitForReplyNodeData
  | GeneratePdfNodeData
  | WaitTimerNodeData
  | FinishFlowNodeData
  | AiCollectorNodeData
  | StravaConnectNodeData
  | PaymentNodeData
  | WhatsAppFlowNodeData
  | WaitForPlayedNodeData
  | AgenticLoopNodeData;

export type AgenticLoopHandoff = {
  nodeId: string;
  label: string;
  description: string;
};

export type AgenticLoopTool =
  | { name: "handoff_to"; enabled: true }
  | { name: "capture_variable"; enabled: boolean }
  | { name: "send_message"; enabled: true }
  | { name: "end_conversation"; enabled: boolean };

export type PaymentConfigFields = {
  planName: string;
  amount: number;
  durationDays: number;
  billingMode?: PaymentBillingMode;
  payerEmailVariable?: string;
  currency?: string;
  messageText?: string;
  ctaButtonText?: string;
  mediaUrl?: string;
  mediaFileName?: string;
};

export type AgenticLoopPaymentToolConfig = PaymentConfigFields & {
  enabled: boolean;
};

export type AgenticLoopNodeData = {
  type: "agenticLoop";
  label: string;
  systemPrompt: string;
  model: string;
  maxTurns: number;
  historyWindowMessages: number;
  handoffTargets: AgenticLoopHandoff[];
  tools: AgenticLoopTool[];
  fallbackHandoffNodeId?: string;
  paymentTool?: AgenticLoopPaymentToolConfig;
};

export type CaptureMode = "full" | "summary";
export type ReplyMatchType = "contains" | "exact" | "startsWith" | "any";

export type TriggerNodeData = {
  type: "trigger";
  label: string;
  triggerType: "keyword" | "newContact" | "manual" | "tag" | "subscriptionPlan";
  audienceScope?: "all" | "newOnly";
  keyword?: string;
  keywordMatch?: "contains" | "notContains" | "exact";
  tagId?: string;
  tagName?: string;
  subscriptionPlan?: "free" | "premium";
  [key: string]: unknown;
};

export type SendMessageNodeData = {
  type: "sendMessage";
  label: string;
  messageType: "text" | "template" | "image" | "file" | "audio" | "video" | "ai";
  variant?: "freeAi";
  textContent?: string;
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  mediaUrl?: string;
  fileName?: string;
  audioSource?: "upload" | "elevenlabs" | "library" | "dynamic";
  audioAssetId?: string;
  audioVoiceId?: string;
  audioScript?: string;
  imageSource?: "upload" | "ai_generate";
  imagePrompt?: string;
  imageCaption?: string;
  videoCaption?: string;
  aiPrompt?: string;
  typingSeconds?: number;
  interactiveType?: "none" | "buttons" | "list";
  replyButtons?: WhatsAppReplyButton[];
  listButtonText?: string;
  listSectionTitle?: string;
  listItems?: WhatsAppListItem[];
  [key: string]: unknown;
};

export type TagConversationNodeData = {
  type: "tagConversation";
  label: string;
  tagId?: string;
  tagName?: string;
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
  variableDescription?: string;
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

export type WaitTimerNodeData = {
  type: "waitTimer";
  label: string;
  timeoutMinutes: number;
  [key: string]: unknown;
};

export type FinishFlowNodeData = {
  type: "finishFlow";
  label: string;
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

export type PaymentBillingMode = "one_time" | "recurring";

export interface WaitForReplyRoute {
  id: string;
  label: string;
  matchType: ReplyMatchType;
  value?: string;
}

export interface AiCollectorField {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

export type StravaConnectNodeData = {
  type: "stravaConnect";
  label: string;
  messageText?: string;
  ctaButtonText?: string;
  skipMessageText?: string;
  skipButtonText?: string;
  mediaUrl?: string;
  mediaFileName?: string;
  imageCaption?: string;
  [key: string]: unknown;
};

export type PaymentNodeData = PaymentConfigFields & {
  type: "payment";
  label: string;
  [key: string]: unknown;
};

export type AiCollectorNodeData = {
  type: "aiCollector";
  label: string;
  fields: AiCollectorField[];
  initialPrompt: string;
  typingSeconds?: number;
  followUpTemplate: string;
  completionMessage?: string;
  maxAttempts: number;
  aiExtractionPrompt?: string;
  [key: string]: unknown;
};

export interface WhatsAppFlowScreen {
  id: string;
  title: string;
  fields: WhatsAppFlowField[];
}

export interface WhatsAppFlowField {
  id: string;
  type: "TextInput" | "TextArea" | "Dropdown" | "RadioButtonsGroup" | "CheckboxGroup" | "DatePicker" | "OptIn";
  label: string;
  name: string;
  required: boolean;
  inputType?: "text" | "number" | "email" | "phone" | "password";
  helperText?: string;
  options?: Array<{ id: string; title: string }>;
}

export type WhatsAppFlowNodeData = {
  type: "whatsappFlow";
  label: string;
  /** External WhatsApp Flow ID (if using a pre-created flow from Meta) */
  externalFlowId?: string;
  /** Body text shown with the flow CTA button */
  bodyText?: string;
  /** Header text (optional) */
  headerText?: string;
  /** CTA button label */
  ctaText?: string;
  /** Screen definitions for auto-created flows */
  screens?: WhatsAppFlowScreen[];
  /** Whether to use a pre-existing flow or auto-create from screens */
  source?: "external" | "builder";
  /** Variable name prefix for captured responses (e.g. "lead" → lead_name, lead_email) */
  variablePrefix?: string;
  /** First screen ID to open (for external flows) */
  firstScreenId?: string;
  /** Draft mode — send as draft for testing */
  draftMode?: boolean;
  [key: string]: unknown;
};

export type WaitForPlayedNodeData = {
  type: "waitForPlayed";
  label: string;
  timeoutMinutes?: number;
  [key: string]: unknown;
};
