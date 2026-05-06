type ExistingConversation =
  | {
      id?: string | null;
    }
  | null
  | undefined;

export function isFirstInboundFromContact(params: {
  existingConversation: ExistingConversation;
  previousContactMessageCount: number | null | undefined;
}) {
  if (!params.existingConversation) {
    return true;
  }

  if (params.previousContactMessageCount !== 0) {
    return false;
  }

  return true;
}
