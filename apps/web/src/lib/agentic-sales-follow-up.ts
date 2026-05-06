export const AGENTIC_SALES_FOLLOW_UP_AFTER_HOURS = 6;
export const AGENTIC_SALES_FOLLOW_UP_LOOKBACK_HOURS = 48;
export const AGENTIC_SALES_FOLLOW_UP_KIND = "post_pdf_agent_silence";
const AGENTIC_LOOP_SALES_MODE_KEY = "__agentic_loop_sales_mode";
export const AGENTIC_SALES_FOLLOW_UP_MESSAGE =
  "Passando por aqui pra nao deixar teu plano parado. O plano inicial ja te da um norte, mas a primeira semana costuma mudar quando rotina, cansaco ou dor aparecem. Quer que eu te mostre como eu ajustaria tua primeira semana se algo sair do planejado?";

export type AgenticSalesFollowUpConversation = {
  current_node_id: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  flow_variables: Record<string, string> | null;
};

export type AgenticSalesFollowUpMessage = {
  sender: string | null;
  node_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AgenticSalesFollowUpDecision =
  | {
      shouldSend: true;
      nodeId: string;
      latestAgenticBotMessageAt: string;
    }
  | {
      shouldSend: false;
      reason: string;
    };

function isPremiumActive(conversation: AgenticSalesFollowUpConversation) {
  return (
    conversation.subscription_status === "active" &&
    conversation.subscription_plan === "premium"
  );
}

function isSalesModeActive(conversation: AgenticSalesFollowUpConversation) {
  return conversation.flow_variables?.[AGENTIC_LOOP_SALES_MODE_KEY] === "true";
}

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isAgenticSalesFollowUpMessage(message: AgenticSalesFollowUpMessage) {
  return (
    message.metadata?.agentic_sales_follow_up_kind ===
    AGENTIC_SALES_FOLLOW_UP_KIND
  );
}

function isOlderThanHours(dateIso: string, now: Date, hours: number) {
  const parsed = parseDate(dateIso);
  if (!parsed) return false;

  return now.getTime() - parsed.getTime() >= hours * 60 * 60 * 1000;
}

export function getAgenticSalesFollowUpDecision(params: {
  now?: Date;
  conversation: AgenticSalesFollowUpConversation;
  messages: AgenticSalesFollowUpMessage[];
}): AgenticSalesFollowUpDecision {
  const now = params.now || new Date();
  const nodeId = params.conversation.current_node_id;

  if (!nodeId) {
    return { shouldSend: false, reason: "missing_active_node" };
  }

  if (!isSalesModeActive(params.conversation)) {
    return { shouldSend: false, reason: "not_sales_mode" };
  }

  if (isPremiumActive(params.conversation)) {
    return { shouldSend: false, reason: "premium_active" };
  }

  const latestAgenticBotMessage = params.messages
    .filter(
      (message) =>
        message.node_id === nodeId &&
        message.sender === "bot" &&
        !isAgenticSalesFollowUpMessage(message)
    )
    .at(-1);

  if (!latestAgenticBotMessage) {
    return { shouldSend: false, reason: "missing_agentic_bot_message" };
  }

  if (
    !isOlderThanHours(
      latestAgenticBotMessage.created_at,
      now,
      AGENTIC_SALES_FOLLOW_UP_AFTER_HOURS
    )
  ) {
    return { shouldSend: false, reason: "too_recent" };
  }

  const userRepliedAfterLatestBot = params.messages.some(
    (message) =>
      message.sender === "contact" &&
      message.created_at > latestAgenticBotMessage.created_at
  );

  if (userRepliedAfterLatestBot) {
    return { shouldSend: false, reason: "user_replied_after_latest_bot" };
  }

  const alreadyFollowedUp = params.messages.some(
    (message) =>
      isAgenticSalesFollowUpMessage(message) &&
      message.metadata?.agentic_sales_follow_up_for ===
        latestAgenticBotMessage.created_at
  );

  if (alreadyFollowedUp) {
    return { shouldSend: false, reason: "already_followed_up" };
  }

  return {
    shouldSend: true,
    nodeId,
    latestAgenticBotMessageAt: latestAgenticBotMessage.created_at,
  };
}
