export const MAX_CONVERSATION_TAG_NAME_LENGTH = 40;

export function normalizeConversationTagName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_CONVERSATION_TAG_NAME_LENGTH);
}
