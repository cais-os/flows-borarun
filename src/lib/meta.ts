import { createHmac, timingSafeEqual } from "crypto";
import type { WhatsAppListItem, WhatsAppReplyButton } from "@/types/node-data";
import {
  buildWhatsAppListPayload,
  buildWhatsAppReplyButtonsPayload,
} from "@/lib/whatsapp";

type MetaConfig = {
  systemToken: string;
  appId: string;
  appSecret: string;
  phoneNumberId: string;
  wabaId: string;
  webhookVerifyToken: string;
  graphApiVersion: string;
};

type MetaRequestInit = {
  method?: "GET" | "POST";
  searchParams?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
};

type SendMetaWhatsAppMessageParams = {
  to: string;
  body: string;
  previewUrl?: boolean;
};

const PLACEHOLDER_PREFIXES = ["your_", "<", "change_me"];

function isMissingValue(value: string | undefined) {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  return PLACEHOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function buildGraphUrl(
  config: MetaConfig,
  path: string,
  searchParams?: MetaRequestInit["searchParams"]
) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/${normalizedPath}`
  );

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function createMetaError(message: string, details?: unknown) {
  return new Error(
    details ? `${message}: ${JSON.stringify(details)}` : message
  );
}

export function getMetaConfig() {
  const config: MetaConfig = {
    systemToken: process.env.META_SYSTEM_TOKEN || "",
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || "",
    wabaId: process.env.META_WABA_ID || "",
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || "",
    graphApiVersion: process.env.META_GRAPH_API_VERSION || "v23.0",
  };

  const missing: string[] = [];

  if (isMissingValue(config.systemToken)) missing.push("META_SYSTEM_TOKEN");
  if (isMissingValue(config.appId)) missing.push("META_APP_ID");
  if (isMissingValue(config.appSecret)) missing.push("META_APP_SECRET");
  if (isMissingValue(config.phoneNumberId)) missing.push("META_PHONE_NUMBER_ID");
  if (isMissingValue(config.wabaId)) missing.push("META_WABA_ID");
  if (isMissingValue(config.webhookVerifyToken)) {
    missing.push("META_WEBHOOK_VERIFY_TOKEN");
  }

  return {
    configured: missing.length === 0,
    missing,
    config,
  };
}

export async function metaGraphRequest<T>(
  path: string,
  init: MetaRequestInit = {}
): Promise<T> {
  const { configured, missing, config } = getMetaConfig();

  if (!configured) {
    throw createMetaError(`Meta config missing: ${missing.join(", ")}`);
  }

  const response = await fetch(buildGraphUrl(config, path, init.searchParams), {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${config.systemToken}`,
      ...(init.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw createMetaError("Meta Graph API request failed", data);
  }

  return data as T;
}

export async function fetchMetaHealth() {
  const { configured, missing, config } = getMetaConfig();

  if (!configured) {
    return {
      configured,
      missing,
    };
  }

  const [phoneNumber, waba] = await Promise.all([
    metaGraphRequest<{
      id: string;
      verified_name?: string;
      display_phone_number?: string;
      quality_rating?: string;
      code_verification_status?: string;
    }>(config.phoneNumberId, {
      searchParams: {
        fields:
          "id,verified_name,display_phone_number,quality_rating,code_verification_status",
      },
    }),
    metaGraphRequest<{
      id: string;
      name?: string;
      timezone_id?: string;
      currency?: string;
    }>(config.wabaId, {
      searchParams: {
        fields: "id,name,timezone_id,currency",
      },
    }),
  ]);

  return {
    configured: true,
    appId: config.appId,
    graphApiVersion: config.graphApiVersion,
    phoneNumber,
    waba,
  };
}

export async function sendMetaWhatsAppTextMessage(
  params: SendMetaWhatsAppMessageParams
) {
  const { config } = getMetaConfig();

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.to,
      type: "text",
      text: {
        preview_url: params.previewUrl ?? false,
        body: params.body,
      },
    },
  });

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppInteractiveButtonsMessage(params: {
  to: string;
  body: string;
  replyButtons: WhatsAppReplyButton[];
}) {
  const { config } = getMetaConfig();

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      recipient_type: "individual",
      to: params.to,
      ...buildWhatsAppReplyButtonsPayload(params.body, params.replyButtons),
    },
  });

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppInteractiveListMessage(params: {
  to: string;
  body: string;
  buttonText: string;
  sectionTitle?: string;
  items: WhatsAppListItem[];
}) {
  const { config } = getMetaConfig();

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      recipient_type: "individual",
      to: params.to,
      ...buildWhatsAppListPayload({
        bodyText: params.body,
        buttonText: params.buttonText,
        sectionTitle: params.sectionTitle,
        items: params.items,
      }),
    },
  });

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppDocumentMessage(params: {
  to: string;
  documentUrl: string;
  fileName?: string;
}) {
  const { config } = getMetaConfig();

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.to,
      type: "document",
      document: {
        link: params.documentUrl,
        filename: params.fileName || "document.pdf",
      },
    },
  });

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppAudioMessage(params: {
  to: string;
  audioUrl: string;
}) {
  const { config } = getMetaConfig();

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.to,
      type: "audio",
      audio: {
        link: params.audioUrl,
      },
    },
  });

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppTemplateMessage(params: {
  to: string;
  templateName: string;
  language?: string;
  components?: Array<{
    type: string;
    parameters: Array<{
      type: string;
      text?: string;
      image?: { link: string };
    }>;
  }>;
}) {
  const { config } = getMetaConfig();

  const templateBody: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.language || "pt_BR" },
      ...(params.components && { components: params.components }),
    },
  };

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: templateBody,
  });

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function markMessageAsRead(messageId: string) {
  const { config } = getMetaConfig();

  return metaGraphRequest(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
  });
}

export async function sendTypingIndicator(messageId: string) {
  const { config } = getMetaConfig();

  return metaGraphRequest(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: {
        type: "text",
      },
    },
  });
}

export async function fetchMetaMessageTemplates() {
  const { config } = getMetaConfig();

  const result = await metaGraphRequest<{
    data?: Array<{
      id: string;
      name: string;
      status?: string;
      category?: string;
      language?: string;
      components?: unknown[];
    }>;
  }>(`${config.wabaId}/message_templates`, {
    searchParams: {
      fields: "id,name,status,category,language,components",
      limit: 100,
    },
  });

  return (result.data || []).map((template) => ({
    id: template.id,
    name: template.name,
    status: template.status,
    category: template.category,
    language: template.language,
    components: template.components,
  }));
}

export async function subscribeMetaAppToWaba() {
  const { config } = getMetaConfig();

  return metaGraphRequest<{ success?: boolean }>(`${config.wabaId}/subscribed_apps`, {
    method: "POST",
  });
}

export function validateMetaWebhookSignature(signature: string | null, rawBody: string) {
  const { configured, config } = getMetaConfig();

  if (!configured) return false;
  if (!signature) return false;

  const expected = `sha256=${createHmac("sha256", config.appSecret)
    .update(rawBody)
    .digest("hex")}`;

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function validateMetaWebhookVerifyToken(token: string | null) {
  const { configured, config } = getMetaConfig();

  if (!configured) return false;
  if (!token) return false;

  return token === config.webhookVerifyToken;
}

export function getMetaWebhookSummary(requestUrl: string) {
  const url = new URL(requestUrl);

  return {
    webhookUrl: url.toString(),
    path: url.pathname,
  };
}
