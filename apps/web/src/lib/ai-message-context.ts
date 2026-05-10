export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiSendMessageHistorySettingsInput = {
  variant?: string;
  includeConversationHistory?: boolean;
  historyWindowMessages?: number;
};

const BASE_AI_SEND_MESSAGE_SYSTEM_PROMPT =
  "Voce e um assistente dentro de um flow automatizado de WhatsApp. " +
  "Responda em portugues brasileiro, de forma natural e concisa (ideal para WhatsApp). " +
  "Siga exatamente as instrucoes do prompt abaixo.";

const HISTORY_AWARE_AI_SEND_MESSAGE_SYSTEM_PROMPT =
  BASE_AI_SEND_MESSAGE_SYSTEM_PROMPT +
  " Use tambem o historico recente da conversa para captar nuances, palavras do usuario e contexto que nao apareceram nas variaveis estruturadas.";

export function buildAiSendMessageChatMessages(params: {
  prompt: string;
  conversationHistory?: AiChatMessage[];
  includeConversationHistory?: boolean;
}): AiChatMessage[] {
  const systemPrompt = params.includeConversationHistory
    ? HISTORY_AWARE_AI_SEND_MESSAGE_SYSTEM_PROMPT
    : BASE_AI_SEND_MESSAGE_SYSTEM_PROMPT;

  return [
    { role: "system", content: systemPrompt },
    ...(params.includeConversationHistory ? params.conversationHistory || [] : []),
    { role: "user", content: params.prompt },
  ];
}

export function resolveAiSendMessageHistorySettings(
  data: AiSendMessageHistorySettingsInput
) {
  return {
    includeConversationHistory:
      data.includeConversationHistory ?? data.variant === "freeAi",
    historyWindowMessages: data.historyWindowMessages || 20,
  };
}
