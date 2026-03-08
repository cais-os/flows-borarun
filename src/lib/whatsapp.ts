import type {
  SendMessageNodeData,
  WhatsAppListItem,
  WhatsAppReplyButton,
} from "@/types/node-data";

export const WHATSAPP_REPLY_BUTTON_LIMIT = 3;
export const WHATSAPP_REPLY_BUTTON_TITLE_LIMIT = 20;
export const WHATSAPP_LIST_ITEM_LIMIT = 10;
export const WHATSAPP_LIST_BUTTON_TEXT_LIMIT = 20;
export const WHATSAPP_LIST_SECTION_TITLE_LIMIT = 24;
export const WHATSAPP_LIST_ITEM_TITLE_LIMIT = 24;
export const WHATSAPP_LIST_ITEM_DESCRIPTION_LIMIT = 72;

export type SendMessageInteractiveType = "none" | "buttons" | "list";

export function getSendMessageInteractiveType(
  data: Pick<
    SendMessageNodeData,
    "messageType" | "interactiveType" | "replyButtons" | "listItems"
  >
): SendMessageInteractiveType {
  if (data.messageType !== "text") return "none";

  if (data.interactiveType === "buttons") {
    return "buttons";
  }

  if (data.interactiveType === "list") {
    return "list";
  }

  if (data.interactiveType === "none") {
    return "none";
  }

  if ((data.replyButtons?.length ?? 0) > 0) {
    return "buttons";
  }

  if ((data.listItems?.length ?? 0) > 0) {
    return "list";
  }

  return "none";
}

export function hasWhatsAppReplyButtons(
  data: Pick<
    SendMessageNodeData,
    "messageType" | "interactiveType" | "replyButtons" | "listItems"
  >
): boolean {
  return (
    getSendMessageInteractiveType(data) === "buttons" &&
    (data.replyButtons?.length ?? 0) > 0
  );
}

export function hasWhatsAppListItems(
  data: Pick<
    SendMessageNodeData,
    "messageType" | "interactiveType" | "replyButtons" | "listItems"
  >
): boolean {
  return (
    getSendMessageInteractiveType(data) === "list" &&
    (data.listItems?.length ?? 0) > 0
  );
}

export function hasWhatsAppInteractiveOptions(
  data: Pick<
    SendMessageNodeData,
    "messageType" | "interactiveType" | "replyButtons" | "listItems"
  >
): boolean {
  return hasWhatsAppReplyButtons(data) || hasWhatsAppListItems(data);
}

export function sanitizeWhatsAppReplyButtonTitle(title: string): string {
  return title.slice(0, WHATSAPP_REPLY_BUTTON_TITLE_LIMIT);
}

export function createWhatsAppReplyButton(index: number): WhatsAppReplyButton {
  return {
    id: `reply-${Date.now()}-${index}`,
    title: sanitizeWhatsAppReplyButtonTitle(`Opcao ${index + 1}`),
  };
}

export function sanitizeWhatsAppListButtonText(text: string): string {
  return text.slice(0, WHATSAPP_LIST_BUTTON_TEXT_LIMIT);
}

export function sanitizeWhatsAppListSectionTitle(title: string): string {
  return title.slice(0, WHATSAPP_LIST_SECTION_TITLE_LIMIT);
}

export function sanitizeWhatsAppListItemTitle(title: string): string {
  return title.slice(0, WHATSAPP_LIST_ITEM_TITLE_LIMIT);
}

export function sanitizeWhatsAppListItemDescription(description: string): string {
  return description.slice(0, WHATSAPP_LIST_ITEM_DESCRIPTION_LIMIT);
}

export function createWhatsAppListItem(index: number): WhatsAppListItem {
  return {
    id: `list-${Date.now()}-${index}`,
    title: sanitizeWhatsAppListItemTitle(`Opcao ${index + 1}`),
    description: "",
  };
}

export function buildWhatsAppReplyButtonsPayload(
  bodyText: string,
  replyButtons: WhatsAppReplyButton[]
) {
  return {
    messaging_product: "whatsapp",
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: replyButtons.map((button) => ({
          type: "reply",
          reply: {
            id: button.id,
            title: button.title,
          },
        })),
      },
    },
  };
}

export function buildWhatsAppListPayload(params: {
  bodyText: string;
  buttonText: string;
  sectionTitle?: string;
  items: WhatsAppListItem[];
}) {
  return {
    messaging_product: "whatsapp",
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: params.bodyText },
      action: {
        button: params.buttonText,
        sections: [
          {
            title: params.sectionTitle || "Opcoes",
            rows: params.items.map((item) => ({
              id: item.id,
              title: item.title,
              ...(item.description?.trim()
                ? { description: item.description.trim() }
                : {}),
            })),
          },
        ],
      },
    },
  };
}

export function getSendMessageInteractiveOptions(
  data: Pick<
    SendMessageNodeData,
    "messageType" | "interactiveType" | "replyButtons" | "listItems"
  >
): Array<{ id: string; title: string; description?: string }> {
  const interactiveType = getSendMessageInteractiveType(data);

  if (interactiveType === "buttons") {
    return (data.replyButtons || []).map((button) => ({
      id: button.id,
      title: button.title,
    }));
  }

  if (interactiveType === "list") {
    return (data.listItems || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
    }));
  }

  return [];
}
