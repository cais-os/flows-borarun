import { createHmac, timingSafeEqual } from "crypto";
import type { OrganizationSettings } from "@/lib/organization";
import type { WhatsAppListItem, WhatsAppReplyButton } from "@/types/node-data";
import {
  buildWhatsAppListPayload,
  buildWhatsAppReplyButtonsPayload,
} from "@/lib/whatsapp";

export type MetaConfig = {
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

function createMetaError(message: string, details?: unknown) {
  return new Error(
    details ? `${message}: ${JSON.stringify(details)}` : message
  );
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

function createMetaConfigResult(config: MetaConfig) {
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

function hasOrganizationMetaOverrides(settings?: OrganizationSettings | null) {
  if (!settings) return false;

  // Only consider it a full override when the essential credentials are set.
  // Having only meta_phone_number_id (used for org resolution) should NOT
  // trigger an override — otherwise the config would have empty tokens.
  return Boolean(
    settings.meta_system_token &&
      settings.meta_app_secret
  );
}

export function getMetaConfig() {
  return createMetaConfigResult({
    systemToken: process.env.META_SYSTEM_TOKEN || "",
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || "",
    wabaId: process.env.META_WABA_ID || "",
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || "",
    graphApiVersion: process.env.META_GRAPH_API_VERSION || "v23.0",
  });
}

export function getMetaConfigFromSettings(settings?: OrganizationSettings | null) {
  if (!hasOrganizationMetaOverrides(settings)) {
    return getMetaConfig();
  }

  return createMetaConfigResult({
    systemToken: settings?.meta_system_token || "",
    appId: settings?.meta_app_id || "",
    appSecret: settings?.meta_app_secret || "",
    phoneNumberId: settings?.meta_phone_number_id || "",
    wabaId: settings?.meta_waba_id || "",
    webhookVerifyToken: settings?.meta_webhook_verify_token || "",
    graphApiVersion: settings?.meta_graph_api_version || "v23.0",
  });
}

function getResolvedMetaConfig(configOverride?: MetaConfig) {
  return configOverride ? createMetaConfigResult(configOverride) : getMetaConfig();
}

export async function metaGraphRequest<T>(
  path: string,
  init: MetaRequestInit = {},
  configOverride?: MetaConfig
): Promise<T> {
  const { configured, missing, config } = getResolvedMetaConfig(configOverride);

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

export async function fetchMetaHealth(configOverride?: MetaConfig) {
  const { configured, missing, config } = getResolvedMetaConfig(configOverride);

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
    }>(
      config.phoneNumberId,
      {
        searchParams: {
          fields:
            "id,verified_name,display_phone_number,quality_rating,code_verification_status",
        },
      },
      config
    ),
    metaGraphRequest<{
      id: string;
      name?: string;
      timezone_id?: string;
      currency?: string;
    }>(
      config.wabaId,
      {
        searchParams: {
          fields: "id,name,timezone_id,currency",
        },
      },
      config
    ),
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
  params: SendMetaWhatsAppMessageParams,
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
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
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppInteractiveButtonsMessage(
  params: {
    to: string;
    body: string;
    replyButtons: WhatsAppReplyButton[];
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        recipient_type: "individual",
        to: params.to,
        ...buildWhatsAppReplyButtonsPayload(params.body, params.replyButtons),
      },
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppInteractiveListMessage(
  params: {
    to: string;
    body: string;
    buttonText: string;
    sectionTitle?: string;
    items: WhatsAppListItem[];
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
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
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppDocumentMessage(
  params: {
    to: string;
    documentUrl: string;
    fileName?: string;
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
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
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppAudioMessage(
  params: {
    to: string;
    audioUrl: string;
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
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
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppVideoMessage(
  params: {
    to: string;
    videoUrl: string;
    caption?: string;
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "video",
        video: {
          link: params.videoUrl,
          ...(params.caption ? { caption: params.caption } : {}),
        },
      },
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppImageMessage(
  params: {
    to: string;
    imageUrl: string;
    caption?: string;
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "image",
        image: {
          link: params.imageUrl,
          ...(params.caption ? { caption: params.caption } : {}),
        },
      },
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function sendMetaWhatsAppTemplateMessage(
  params: {
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
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

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
  }>(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: templateBody,
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export async function markMessageAsRead(
  messageId: string,
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  return metaGraphRequest(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
    },
    config
  );
}

export async function sendTypingIndicator(
  messageId: string,
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  return metaGraphRequest(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: {
          type: "text",
        },
      },
    },
    config
  );
}

export async function fetchMetaMessageTemplates(configOverride?: MetaConfig) {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    data?: Array<{
      id: string;
      name: string;
      status?: string;
      category?: string;
      language?: string;
      components?: unknown[];
    }>;
  }>(
    `${config.wabaId}/message_templates`,
    {
      searchParams: {
        fields: "id,name,status,category,language,components",
        limit: 100,
      },
    },
    config
  );

  return (result.data || []).map((template) => ({
    id: template.id,
    name: template.name,
    status: template.status,
    category: template.category,
    language: template.language,
    components: template.components,
  }));
}

export async function subscribeMetaAppToWaba(configOverride?: MetaConfig) {
  const { config } = getResolvedMetaConfig(configOverride);

  return metaGraphRequest<{ success?: boolean }>(
    `${config.wabaId}/subscribed_apps`,
    {
      method: "POST",
    },
    config
  );
}

export function validateMetaWebhookSignature(
  signature: string | null,
  rawBody: string,
  configOverride?: MetaConfig
) {
  const { configured, config } = getResolvedMetaConfig(configOverride);

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

export function validateMetaWebhookVerifyToken(
  token: string | null,
  configOverride?: MetaConfig
) {
  const { configured, config } = getResolvedMetaConfig(configOverride);

  if (!configured) return false;
  if (!token) return false;

  return token === config.webhookVerifyToken;
}

export async function downloadMetaMedia(
  mediaId: string,
  configOverride?: MetaConfig
): Promise<Buffer> {
  const { configured, missing, config } = getResolvedMetaConfig(configOverride);

  if (!configured) {
    throw createMetaError(`Meta config missing: ${missing.join(", ")}`);
  }

  const mediaInfo = await metaGraphRequest<{ url: string }>(
    mediaId,
    {},
    config
  );

  const response = await fetch(mediaInfo.url, {
    headers: { Authorization: `Bearer ${config.systemToken}` },
  });

  if (!response.ok) {
    throw createMetaError("Failed to download media from Meta", {
      status: response.status,
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendMetaWhatsAppCtaUrlMessage(
  params: {
    to: string;
    bodyText: string;
    buttonText: string;
    url: string;
    headerText?: string;
    footerText?: string;
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const interactive: Record<string, unknown> = {
    type: "cta_url",
    body: { text: params.bodyText },
    action: {
      name: "cta_url",
      parameters: {
        display_text: params.buttonText,
        url: params.url,
      },
    },
  };

  if (params.headerText) {
    interactive.header = { type: "text", text: params.headerText };
  }
  if (params.footerText) {
    interactive.footer = { text: params.footerText };
  }

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "interactive",
        interactive,
      },
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}

export function getMetaWebhookSummary(requestUrl: string) {
  const url = new URL(requestUrl);

  return {
    webhookUrl: url.toString(),
    path: url.pathname,
  };
}

/* ------------------------------------------------------------------ */
/*  WhatsApp Flows                                                     */
/* ------------------------------------------------------------------ */

export type WhatsAppFlowCategory = "LEAD_GENERATION" | "CONTACT_US" | "CUSTOMER_SUPPORT" | "SURVEY" | "SIGN_UP" | "SIGN_IN" | "APPOINTMENT_BOOKING" | "OTHER";

export type WhatsAppFlowInfo = {
  id: string;
  name: string;
  status: string;
  categories: WhatsAppFlowCategory[];
};

/**
 * List all WhatsApp Flows for the WABA.
 */
export async function listWhatsAppFlows(
  configOverride?: MetaConfig
): Promise<WhatsAppFlowInfo[]> {
  const { config } = getResolvedMetaConfig(configOverride);

  const result = await metaGraphRequest<{
    data?: WhatsAppFlowInfo[];
  }>(
    `${config.wabaId}/flows`,
    { searchParams: { fields: "id,name,status,categories" } },
    config
  );

  return result.data || [];
}

/**
 * Create a new WhatsApp Flow.
 */
export async function createWhatsAppFlow(
  params: {
    name: string;
    categories?: WhatsAppFlowCategory[];
    endpointUri?: string;
  },
  configOverride?: MetaConfig
): Promise<{ id: string }> {
  const { config } = getResolvedMetaConfig(configOverride);

  return metaGraphRequest<{ id: string }>(
    `${config.wabaId}/flows`,
    {
      method: "POST",
      body: {
        name: params.name,
        categories: params.categories || ["OTHER"],
        ...(params.endpointUri ? { endpoint_uri: params.endpointUri } : {}),
      },
    },
    config
  );
}

/**
 * Upload a flow JSON definition to an existing WhatsApp Flow.
 */
export async function updateWhatsAppFlowJson(
  flowId: string,
  flowJson: string,
  configOverride?: MetaConfig
): Promise<{ success: boolean }> {
  const { configured, missing, config } = getResolvedMetaConfig(configOverride);

  if (!configured) {
    throw createMetaError(`Meta config missing: ${missing.join(", ")}`);
  }

  const formData = new FormData();
  formData.append("name", "flow.json");
  formData.append(
    "asset_type",
    "FLOW_JSON"
  );
  formData.append(
    "file",
    new Blob([flowJson], { type: "application/json" }),
    "flow.json"
  );

  const url = buildGraphUrl(config, `${flowId}/assets`);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.systemToken}` },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw createMetaError("Failed to update WhatsApp Flow JSON", data);
  }

  return { success: true };
}

/**
 * Publish a WhatsApp Flow (DRAFT → PUBLISHED). Cannot be undone.
 */
export async function publishWhatsAppFlow(
  flowId: string,
  configOverride?: MetaConfig
): Promise<{ success: boolean }> {
  const { config } = getResolvedMetaConfig(configOverride);

  return metaGraphRequest<{ success: boolean }>(
    `${flowId}/publish`,
    { method: "POST" },
    config
  );
}

/**
 * Send a WhatsApp Flow interactive message to a user.
 */
export async function sendMetaWhatsAppFlowMessage(
  params: {
    to: string;
    flowId: string;
    flowToken: string;
    headerText?: string;
    bodyText: string;
    footerText?: string;
    ctaText?: string;
    screenId?: string;
    flowData?: Record<string, unknown>;
    mode?: "draft" | "published";
  },
  configOverride?: MetaConfig
) {
  const { config } = getResolvedMetaConfig(configOverride);

  const actionPayload: Record<string, unknown> = {
    name: "flow",
    parameters: {
      flow_message_version: "3",
      flow_id: params.flowId,
      flow_token: params.flowToken,
      flow_cta: params.ctaText || "Abrir formulario",
      flow_action: "navigate",
      flow_action_payload: {
        screen: params.screenId || "WELCOME_SCREEN",
        ...(params.flowData && Object.keys(params.flowData).length > 0
          ? { data: params.flowData }
          : {}),
      },
      ...(params.mode === "draft" ? { mode: "draft" } : {}),
    },
  };

  const result = await metaGraphRequest<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  }>(
    `${config.phoneNumberId}/messages`,
    {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "interactive",
        interactive: {
          type: "flow",
          ...(params.headerText
            ? { header: { type: "text", text: params.headerText } }
            : {}),
          body: { text: params.bodyText },
          ...(params.footerText
            ? { footer: { text: params.footerText } }
            : {}),
          action: actionPayload,
        },
      },
    },
    config
  );

  return {
    messageId: result.messages?.[0]?.id || null,
    contact: result.contacts?.[0] || null,
  };
}
