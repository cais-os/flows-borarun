import { createHash } from "crypto";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flow } from "@/types/flow";
import type {
  NodeData,
  TriggerNodeData,
  SendMessageNodeData,
  TagConversationNodeData,
  RandomizerNodeData,
  WaitForReplyNodeData,
  GeneratePdfNodeData,
  WaitTimerNodeData,
  AiCollectorNodeData,
  StravaConnectNodeData,
  PaymentNodeData,
  WhatsAppFlowNodeData,
  WaitForPlayedNodeData,
} from "@/types/node-data";
import {
  extractFieldsFromText,
  getMissingFields,
  buildFollowUpMessage,
} from "@/lib/ai-collector";
import { createGeneratedAudioAsset } from "@/lib/audio-assets";
import { buildCapturedVariableValue } from "@/lib/captured-variable";
import { generatePdf } from "@/lib/pdf-generator";
import {
  buildStravaConnectUrl,
  buildStravaConnectMessage,
  buildStravaCoachContext,
  resolveAppOrigin,
} from "@/lib/strava";
import {
  getMercadoPagoConfig,
  createPaymentAndPreference,
  buildPaymentMessage,
} from "@/lib/mercado-pago";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  buildNoMatchResponseMessage,
  getMatchedWaitRoute,
  normalizeWaitForReplyNodeData,
} from "@/lib/wait-for-reply";
import { convertToOgg, getAudioFormat, needsOggConversion } from "@/lib/audio-converter";
import { getCronSecret } from "@/lib/internal-auth";
import {
  type MetaConfig,
  sendMetaWhatsAppTextMessage,
  sendMetaWhatsAppAudioMessage,
  sendMetaWhatsAppDocumentMessage,
  sendMetaWhatsAppImageMessage,
  sendMetaWhatsAppVideoMessage,
  sendMetaWhatsAppInteractiveButtonsMessage,
  sendMetaWhatsAppInteractiveListMessage,
  sendMetaWhatsAppFlowMessage,
  sendMetaWhatsAppCtaUrlMessage,
  createWhatsAppFlow,
  updateWhatsAppFlowJson,
  publishWhatsAppFlow,
  sendTypingIndicator,
} from "@/lib/meta";
import {
  getSendMessageInteractiveType,
  hasWhatsAppListItems,
  hasWhatsAppInteractiveOptions,
  hasWhatsAppReplyButtons,
} from "@/lib/whatsapp";

interface FlowNode {
  id: string;
  data: NodeData;
  [key: string]: unknown;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  [key: string]: unknown;
}

interface TriggerMatchContext {
  tagIds: Set<string>;
  tagNames: Set<string>;
  subscriptionPlan?: "free" | "premium";
}

const FLOW_CONTINUATION_SOFT_LIMIT_MS = 50_000;
const PDF_CONTINUATION_BUFFER_MS = 1_000;
const PDF_POST_SEND_SETTLE_MS = 750;
const DEFAULT_MESSAGE_ORDER_DELAY_MS = 900;
const AUDIO_MESSAGE_ORDER_DELAY_MS = 350;
const UPCOMING_AUDIO_PREWARM_LIMIT = 2;
const preparedMediaUrlCache = new Map<string, string>();
const pendingMediaUrlPreparations = new Map<string, Promise<string>>();

function findNextNodes(
  nodeId: string,
  edges: FlowEdge[],
  nodes: FlowNode[],
  sourceHandle?: string
): FlowNode[] {
  const outEdges = edges.filter(
    (edge) =>
      edge.source === nodeId &&
      (!sourceHandle || edge.sourceHandle === sourceHandle)
  );

  const seen = new Set<string>();
  return outEdges
    .map((edge) => nodes.find((node) => node.id === edge.target))
    .filter((node): node is FlowNode => {
      if (!node || seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
}

function findNextNodesForHandleOrLegacy(
  nodeId: string,
  edges: FlowEdge[],
  nodes: FlowNode[],
  sourceHandle?: string
): FlowNode[] {
  if (sourceHandle) {
    const matchedNodes = findNextNodes(nodeId, edges, nodes, sourceHandle);
    if (matchedNodes.length > 0) return matchedNodes;

    const hasHandledEdges = edges.some(
      (edge) => edge.source === nodeId && !!edge.sourceHandle
    );
    if (hasHandledEdges) return [];
  }

  return findNextNodes(nodeId, edges, nodes);
}

function mergeQueues(...groups: FlowNode[][]): FlowNode[] {
  const seenIds = new Set<string>();
  const merged: FlowNode[] = [];

  for (const group of groups) {
    for (const node of group) {
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);
      merged.push(node);
    }
  }

  return merged;
}

function getEstimatedNodeCostMs(node: FlowNode): number {
  switch (node.data.type) {
    case "generatePdf":
      return 45_000;
    case "payment":
      return 8_000;
    case "stravaConnect":
    case "whatsappFlow":
      return 6_000;
    case "sendMessage": {
      const sendData = node.data as SendMessageNodeData;
      if (sendData.messageType === "audio") return 10_000;
      if (
        sendData.messageType === "image" ||
        sendData.messageType === "video" ||
        sendData.messageType === "file"
      ) {
        return 8_000;
      }
      return 3_000;
    }
    default:
      return 2_000;
  }
}

function shouldYieldFlowExecution(startedAt: number, currentNode: FlowNode) {
  return (
    Date.now() - startedAt + getEstimatedNodeCostMs(currentNode) >=
    FLOW_CONTINUATION_SOFT_LIMIT_MS
  );
}

function shouldYieldBeforeGeneratePdf(
  startedAt: number,
  currentNode: FlowNode,
  remainingQueue: FlowNode[]
) {
  return (
    currentNode.data.type === "generatePdf" &&
    remainingQueue.length > 0 &&
    Date.now() - startedAt >= PDF_CONTINUATION_BUFFER_MS
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPostSendDelayMs(sendData: SendMessageNodeData) {
  return sendData.messageType === "audio"
    ? AUDIO_MESSAGE_ORDER_DELAY_MS
    : DEFAULT_MESSAGE_ORDER_DELAY_MS;
}

function interpolateVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => variables[key] || `{{${key}}}`
  );
}

function pickRandomPath(splits: RandomizerNodeData["splits"]): string {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const split of splits) {
    cumulative += split.percentage;
    if (rand <= cumulative) return split.id;
  }

  return splits[splits.length - 1].id;
}

async function getConversationVariables(
  supabase: SupabaseClient,
  conversationId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("conversations")
    .select("flow_variables")
    .eq("id", conversationId)
    .single();

  return (data?.flow_variables as Record<string, string>) || {};
}

async function sendTextAndPersist(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  nodeId: string;
  text: string;
  metaConfig: MetaConfig;
  skipTyping?: boolean;
  inboundMessageId?: string;
}) {
  if (!params.skipTyping && params.inboundMessageId) {
    await sendTypingIndicator(params.inboundMessageId, params.metaConfig).catch(() => {});
  }
  const result = await sendMetaWhatsAppTextMessage(
    {
      to: params.contactPhone,
      body: params.text,
    },
    params.metaConfig
  );

  await params.supabase.from("messages").insert({
    conversation_id: params.conversationId,
    content: params.text,
    type: "text",
    sender: "bot",
    node_id: params.nodeId,
    wa_message_id: result.messageId,
  });
}

async function sendWaitPrompt(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  nodeId: string;
  data: WaitForReplyNodeData;
  metaConfig: MetaConfig;
  inboundMessageId?: string;
}) {
  if (!params.data.promptMessage) return;

  const variables = await getConversationVariables(
    params.supabase,
    params.conversationId
  );
  const interpolated = interpolateVariables(params.data.promptMessage, variables);

  try {
    await sendTextAndPersist({
      supabase: params.supabase,
      conversationId: params.conversationId,
      contactPhone: params.contactPhone,
      nodeId: params.nodeId,
      text: interpolated,
      metaConfig: params.metaConfig,
      inboundMessageId: params.inboundMessageId,
    });
  } catch (error) {
    console.error("Flow engine: failed to send prompt message", error);
  }
}

// ---------------------------------------------------------------------------
// Analytics tracking helpers
// ---------------------------------------------------------------------------

async function createFlowExecution(
  supabase: SupabaseClient,
  flowId: string,
  conversationId: string,
  organizationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("flow_executions")
    .insert({
      flow_id: flowId,
      conversation_id: conversationId,
      organization_id: organizationId,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[analytics] failed to create flow_execution", error);
    return null;
  }
  return data.id as string;
}

function logNodeEvent(
  supabase: SupabaseClient,
  params: {
    executionId: string | null;
    flowId: string;
    nodeId: string;
    nodeType: string;
    conversationId: string;
    organizationId: string;
  }
) {
  if (!params.executionId) return;
  supabase
    .from("flow_node_events")
    .insert({
      execution_id: params.executionId,
      flow_id: params.flowId,
      node_id: params.nodeId,
      node_type: params.nodeType,
      conversation_id: params.conversationId,
      organization_id: params.organizationId,
    })
    .then(({ error }) => {
      if (error) console.error("[analytics] failed to log node event", error);
    });
}

async function completeFlowExecution(
  supabase: SupabaseClient,
  executionId: string | null,
  status: "completed" | "abandoned" = "completed"
) {
  if (!executionId) return;
  await supabase
    .from("flow_executions")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("id", executionId)
    .eq("status", "running");
}

async function findActiveExecutionId(
  supabase: SupabaseClient,
  flowId: string,
  conversationId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("flow_executions")
    .select("id")
    .eq("flow_id", flowId)
    .eq("conversation_id", conversationId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) || null;
}

// ---------------------------------------------------------------------------

async function pauseFlow(params: {
  supabase: SupabaseClient;
  conversationId: string;
  currentNodeId: string;
  queue: FlowNode[];
}) {
  await params.supabase
    .from("conversations")
    .update({
      status: "paused",
      current_node_id: params.currentNodeId,
      flow_node_queue: params.queue.map((node) => node.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.conversationId);
}

async function persistFlowContinuation(params: {
  supabase: SupabaseClient;
  conversationId: string;
  queue: FlowNode[];
}) {
  await params.supabase
    .from("conversations")
    .update({
      status: "running",
      current_node_id: null,
      flow_node_queue: params.queue.map((node) => node.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.conversationId);
}

function triggerFlowContinuation(params: {
  conversationId: string;
  contactPhone: string;
  organizationId: string;
}) {
  const secret = getCronSecret();
  if (!secret) {
    console.error("[flow-engine] CRON_SECRET is not configured; cannot continue flow");
    return;
  }

  let origin: string;
  try {
    origin = resolveAppOrigin();
  } catch (error) {
    console.error("[flow-engine] failed to resolve app origin for continuation", error);
    return;
  }

  fetch(`${origin}/api/flow/continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({
      conversationId: params.conversationId,
      contactPhone: params.contactPhone,
      organizationId: params.organizationId,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        console.error(
          "[flow-engine] flow continuation request failed:",
          response.status,
          await response.text()
        );
      }
    })
    .catch((error) =>
      console.error("[flow-engine] failed to trigger flow continuation", error)
    );
}

async function yieldFlowExecution(params: {
  supabase: SupabaseClient;
  conversationId: string;
  contactPhone: string;
  organizationId: string;
  currentNode: FlowNode;
  remainingQueue: FlowNode[];
}) {
  console.warn("[flow-engine] yielding flow continuation", {
    conversationId: params.conversationId,
    currentNodeId: params.currentNode.id,
    currentNodeType: params.currentNode.data.type,
    remainingQueueLength: params.remainingQueue.length,
  });

  await persistFlowContinuation({
    supabase: params.supabase,
    conversationId: params.conversationId,
    queue: params.remainingQueue,
  });

  triggerFlowContinuation({
    conversationId: params.conversationId,
    contactPhone: params.contactPhone,
    organizationId: params.organizationId,
  });

  return "continued" as const;
}

async function completeFlow(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase
    .from("conversations")
    .update({
      active_flow_id: null,
      flow_node_queue: null,
      current_node_id: null,
      timeout_at: null,
      status: "ai",
      ai_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

async function finalizeFlow(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase
    .from("conversations")
    .update({
      active_flow_id: null,
      flow_node_queue: null,
      current_node_id: null,
      timeout_at: null,
      status: "completed",
      ai_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

async function applyTypingDelay(
  inboundMessageId: string | undefined,
  typingSeconds: number | undefined,
  metaConfig: MetaConfig
) {
  // Skip typing delays for programmatic resumes (no inbound message)
  // to avoid accumulating delays that cause Vercel function timeouts
  if (!inboundMessageId) return;

  const seconds = Math.max(0, Math.min(30, typingSeconds || 0));

  await sendTypingIndicator(inboundMessageId, metaConfig).catch(() => {});

  if (seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

async function loadTriggerMatchContext(
  supabase: SupabaseClient,
  conversationId: string,
  organizationId: string
): Promise<TriggerMatchContext> {
  const context: TriggerMatchContext = {
    tagIds: new Set<string>(),
    tagNames: new Set<string>(),
  };

  const [{ data: assignments, error: assignmentsError }, { data: settings, error: settingsError }] =
    await Promise.all([
      supabase
        .from("conversation_tag_assignments")
        .select("tag_id")
        .eq("conversation_id", conversationId),
      supabase
        .from("organization_settings")
        .select("subscription_plan")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  if (assignmentsError) {
    console.error("Flow engine: failed to load conversation tags for trigger matching", assignmentsError);
  }

  const tagIds = (assignments || [])
    .map((assignment) => assignment.tag_id)
    .filter((tagId): tagId is string => typeof tagId === "string" && tagId.length > 0);

  if (tagIds.length > 0) {
    for (const tagId of tagIds) {
      context.tagIds.add(tagId);
    }

    const { data: tags, error: tagsError } = await supabase
      .from("conversation_tags")
      .select("id, name")
      .in("id", tagIds);

    if (tagsError) {
      console.error("Flow engine: failed to resolve tag names for trigger matching", tagsError);
    } else {
      for (const tag of tags || []) {
        if (typeof tag.id === "string" && tag.id.length > 0) {
          context.tagIds.add(tag.id);
        }
        if (typeof tag.name === "string" && tag.name.trim().length > 0) {
          context.tagNames.add(tag.name.trim().toLowerCase());
        }
      }
    }
  }

  if (settingsError) {
    console.error("Flow engine: failed to load subscription plan for trigger matching", settingsError);
  } else if (
    settings?.subscription_plan === "free" ||
    settings?.subscription_plan === "premium"
  ) {
    context.subscriptionPlan = settings.subscription_plan;
  }

  return context;
}

function getTriggerPriority(triggerType: TriggerNodeData["triggerType"]): number {
  if (triggerType === "keyword") return 40;
  if (triggerType === "newContact") return 30;
  if (triggerType === "tag") return 20;
  if (triggerType === "subscriptionPlan") return 10;
  return 0;
}

function shouldApplyScopedTrigger(
  triggerData: TriggerNodeData,
  isNewContact: boolean
): boolean {
  if (
    triggerData.triggerType !== "tag" &&
    triggerData.triggerType !== "subscriptionPlan"
  ) {
    return true;
  }

  const audienceScope = triggerData.audienceScope || "all";
  if (audienceScope === "newOnly" && !isNewContact) {
    return false;
  }

  return true;
}

async function generateAiNodeResponse(
  supabase: SupabaseClient,
  prompt: string,
  organizationId: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Fetch AI coach guidelines for model/temperature config
  const { data: guidelines } = await supabase
    .from("ai_guidelines")
    .select("model, temperature, max_tokens")
    .eq("organization_id", organizationId)
    .eq("key", "ai_coach")
    .maybeSingle();

  const model = guidelines?.model || "gpt-4o-mini";
  const temperature = guidelines?.temperature ?? 0.7;
  const maxTokens = guidelines?.max_tokens ?? 500;

  const completion = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content:
          "Voce e um assistente dentro de um flow automatizado de WhatsApp. " +
          "Responda em portugues brasileiro, de forma natural e concisa (ideal para WhatsApp). " +
          "Siga exatamente as instrucoes do prompt abaixo.",
      },
      { role: "user", content: prompt },
    ],
  });

  return (
    completion.choices[0]?.message?.content ||
    "Desculpe, nao consegui gerar uma resposta."
  );
}

async function generateAiImage(prompt: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("DALL-E returned no image data");

  return b64;
}

function getStorageFileExtension(contentType: string, fileName?: string) {
  const fileNameExt = fileName?.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase();
  if (fileNameExt) {
    return fileNameExt;
  }

  if (contentType === "audio/ogg") return "ogg";

  const rawExt = contentType.split("/")[1] || "bin";
  return rawExt.split("+")[0].toLowerCase();
}

async function doesPublicAssetExist(publicUrl: string) {
  try {
    const headResponse = await fetch(publicUrl, {
      method: "HEAD",
      cache: "no-store",
    });

    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405) {
      return false;
    }

    const fallbackResponse = await fetch(publicUrl, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
      },
      cache: "no-store",
    });

    return fallbackResponse.ok;
  } catch (error) {
    console.warn("[resolveStorageMediaUrl] failed to verify cached media", error);
    return false;
  }
}

async function resolveStorageMediaUrl(params: {
  supabase: SupabaseClient;
  bucket: string;
  filePrefix: string;
  conversationId: string;
  mediaUrl: string;
  fallbackContentType: string;
  convertAudioToOgg?: boolean;
  fileName?: string;
}) {
  if (!params.mediaUrl.startsWith("data:")) {
    return params.mediaUrl;
  }

  const mimeMatch = params.mediaUrl.match(/data:([^;]+)/);
  const sourceContentType = mimeMatch?.[1] || params.fallbackContentType;
  const shouldConvertAudioToOgg =
    Boolean(params.convertAudioToOgg) &&
    sourceContentType.startsWith("audio/") &&
    needsOggConversion(sourceContentType, params.fileName);
  const targetContentType = shouldConvertAudioToOgg
    ? "audio/ogg"
    : sourceContentType;
  const fileHash = createHash("sha1").update(params.mediaUrl).digest("hex");
  const cachedFolder = `${params.filePrefix}-cache`;
  const targetPath = `${cachedFolder}/${fileHash}.${getStorageFileExtension(
    targetContentType,
    params.fileName
  )}`;
  const cacheKey = `${params.bucket}:${targetPath}`;

  const cachedUrl = preparedMediaUrlCache.get(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  const pendingPreparation = pendingMediaUrlPreparations.get(cacheKey);
  if (pendingPreparation) {
    return pendingPreparation;
  }

  const preparation = (async () => {
    const { data: targetUrlData } = params.supabase.storage
      .from(params.bucket)
      .getPublicUrl(targetPath);

    if (await doesPublicAssetExist(targetUrlData.publicUrl)) {
      preparedMediaUrlCache.set(cacheKey, targetUrlData.publicUrl);
      return targetUrlData.publicUrl;
    }

    const base64Data = params.mediaUrl.split(",")[1];
    let buffer = Buffer.from(base64Data || "", "base64");
    let uploadPath = targetPath;
    let uploadContentType = targetContentType;

    if (shouldConvertAudioToOgg) {
      try {
        const sourceFormat = getAudioFormat(sourceContentType, params.fileName);
        buffer = Buffer.from(await convertToOgg(buffer, sourceFormat));
      } catch (error) {
        console.error(
          "[resolveStorageMediaUrl] OGG conversion failed, using original:",
          error
        );
        uploadContentType = sourceContentType;
        uploadPath = `${cachedFolder}/${fileHash}.${getStorageFileExtension(
          sourceContentType,
          params.fileName
        )}`;

        const { data: fallbackUrlData } = params.supabase.storage
          .from(params.bucket)
          .getPublicUrl(uploadPath);

        if (await doesPublicAssetExist(fallbackUrlData.publicUrl)) {
          preparedMediaUrlCache.set(cacheKey, fallbackUrlData.publicUrl);
          preparedMediaUrlCache.set(
            `${params.bucket}:${uploadPath}`,
            fallbackUrlData.publicUrl
          );
          return fallbackUrlData.publicUrl;
        }
      }
    }

    const { error: uploadError } = await params.supabase.storage
      .from(params.bucket)
      .upload(uploadPath, buffer, { contentType: uploadContentType, upsert: false });

    if (uploadError && !uploadError.message?.toLowerCase().includes("already")) {
      throw uploadError;
    }

    const { data: urlData } = params.supabase.storage
      .from(params.bucket)
      .getPublicUrl(uploadPath);

    preparedMediaUrlCache.set(cacheKey, urlData.publicUrl);
    preparedMediaUrlCache.set(`${params.bucket}:${uploadPath}`, urlData.publicUrl);
    return urlData.publicUrl;
  })();

  pendingMediaUrlPreparations.set(cacheKey, preparation);

  try {
    return await preparation;
  } finally {
    pendingMediaUrlPreparations.delete(cacheKey);
  }
}

function getUpcomingStaticAudioNodes(queue: FlowNode[], limit: number) {
  const upcomingAudioNodes: Array<{
    nodeId: string;
    data: SendMessageNodeData;
  }> = [];

  for (const node of queue) {
    if (node.data.type !== "sendMessage") continue;

    const sendData = node.data as SendMessageNodeData;
    if (
      sendData.messageType === "audio" &&
      sendData.audioSource !== "dynamic" &&
      typeof sendData.mediaUrl === "string" &&
      sendData.mediaUrl.startsWith("data:")
    ) {
      upcomingAudioNodes.push({
        nodeId: node.id,
        data: sendData,
      });
    }

    if (upcomingAudioNodes.length >= limit) {
      break;
    }
  }

  return upcomingAudioNodes;
}

async function prewarmUpcomingStaticAudioMedia(params: {
  supabase: SupabaseClient;
  conversationId: string;
  queue: FlowNode[];
}) {
  const audioNodes = getUpcomingStaticAudioNodes(
    params.queue,
    UPCOMING_AUDIO_PREWARM_LIMIT
  );

  if (audioNodes.length === 0) {
    return;
  }

  await Promise.allSettled(
    audioNodes.map(({ data }) =>
      resolveStorageMediaUrl({
        supabase: params.supabase,
        bucket: "audio",
        filePrefix: "audio",
        conversationId: params.conversationId,
        mediaUrl: data.mediaUrl as string,
        fallbackContentType: "audio/mpeg",
        convertAudioToOgg: true,
        fileName: data.fileName,
      })
    )
  );
}

async function executeSendMessageNode(params: {
  supabase: SupabaseClient;
  organizationId: string;
  metaConfig: MetaConfig;
  conversationId: string;
  contactPhone: string;
  node: FlowNode;
  data: SendMessageNodeData;
  inboundMessageId?: string;
}) {
  const flowVariables = await getConversationVariables(
    params.supabase,
    params.conversationId
  );
  const text = params.data.textContent
    ? interpolateVariables(params.data.textContent, flowVariables)
    : "";
  const interactiveType = getSendMessageInteractiveType(params.data);
  const typingSeconds = params.data.typingSeconds;

  if (
    params.data.messageType === "text" &&
    interactiveType === "buttons" &&
    hasWhatsAppReplyButtons(params.data) &&
    text
  ) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      const result = await sendMetaWhatsAppInteractiveButtonsMessage(
        {
          to: params.contactPhone,
          body: text,
          replyButtons: params.data.replyButtons || [],
        },
        params.metaConfig
      );

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: text,
        type: "text",
        sender: "bot",
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send interactive buttons", error);
    }
  } else if (
    params.data.messageType === "text" &&
    interactiveType === "list" &&
    hasWhatsAppListItems(params.data) &&
    text
  ) {
    try {
      console.log("[flow-engine] sending interactive list", {
        nodeId: params.node.id,
        text: text.substring(0, 50),
        itemCount: params.data.listItems?.length,
      });
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      const result = await sendMetaWhatsAppInteractiveListMessage(
        {
          to: params.contactPhone,
          body: text,
          buttonText: params.data.listButtonText || "Ver opcoes",
          sectionTitle: params.data.listSectionTitle || "Opcoes",
          items: params.data.listItems || [],
        },
        params.metaConfig
      );

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: text,
        type: "text",
        sender: "bot",
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send interactive list", error);
    }
  } else if (text && params.data.messageType === "text") {
    try {
      console.log("[flow-engine] sending plain text", {
        nodeId: params.node.id,
        interactiveType,
        hasListItems: (params.data.listItems?.length ?? 0) > 0,
      });
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      await sendTextAndPersist({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        nodeId: params.node.id,
        text,
        metaConfig: params.metaConfig,
        skipTyping: true,
      });
    } catch (error) {
      console.error("Flow engine: failed to send message", error);
    }
  }

  if (
    params.data.messageType === "audio" &&
    params.data.audioSource !== "dynamic" &&
    params.data.mediaUrl
  ) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);

      // Convert uploaded audio to OGG for WhatsApp voice note display
      const audioUrl = await resolveStorageMediaUrl({
        supabase: params.supabase,
        bucket: "audio",
        filePrefix: "audio",
        conversationId: params.conversationId,
        mediaUrl: params.data.mediaUrl,
        fallbackContentType: "audio/mpeg",
        convertAudioToOgg: true,
        fileName: params.data.fileName,
      });

      const result = await sendMetaWhatsAppAudioMessage(
        {
          to: params.contactPhone,
          audioUrl,
        },
        params.metaConfig
      );


      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: params.data.fileName || "Audio",
        type: "audio",
        sender: "bot",
        media_url: audioUrl,
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send audio", error);
    }
  }

  if (
    params.data.messageType === "audio" &&
    params.data.audioSource === "dynamic" &&
    params.data.audioScript &&
    params.data.audioVoiceId
  ) {
    try {
      const interpolatedScript = interpolateVariables(
        params.data.audioScript,
        flowVariables
      );
      const generatedAudio = await createGeneratedAudioAsset({
        supabase: params.supabase,
        organizationId: params.organizationId,
        text: interpolatedScript,
        voiceId: params.data.audioVoiceId,
        name: params.data.fileName,
        persistRecord: false,
      });

      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      const result = await sendMetaWhatsAppAudioMessage(
        {
          to: params.contactPhone,
          audioUrl: generatedAudio.audioUrl,
        },
        params.metaConfig
      );


      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: generatedAudio.name,
        type: "audio",
        sender: "bot",
        media_url: generatedAudio.audioUrl,
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to generate dynamic audio", error);
    }
  }

  if (params.data.messageType === "video" && params.data.mediaUrl) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      const videoUrl = await resolveStorageMediaUrl({
        supabase: params.supabase,
        bucket: "images",
        filePrefix: "video",
        conversationId: params.conversationId,
        mediaUrl: params.data.mediaUrl,
        fallbackContentType: "video/mp4",
        fileName: params.data.fileName,
      });
      const caption = params.data.videoCaption
        ? interpolateVariables(params.data.videoCaption, flowVariables)
        : undefined;

      const result = await sendMetaWhatsAppVideoMessage(
        {
          to: params.contactPhone,
          videoUrl,
          caption,
        },
        params.metaConfig
      );

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: caption || params.data.fileName || "Video",
        type: "video",
        sender: "bot",
        media_url: videoUrl,
        file_name: params.data.fileName,
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send video", error);
    }
  }

  if (params.data.messageType === "ai" && params.data.aiPrompt) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      const aiPrompt = interpolateVariables(params.data.aiPrompt, flowVariables);
      const aiText = await generateAiNodeResponse(
        params.supabase,
        aiPrompt,
        params.organizationId
      );
      await sendTextAndPersist({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        nodeId: params.node.id,
        text: aiText,
        metaConfig: params.metaConfig,
        skipTyping: true,
      });
    } catch (error) {
      console.error("Flow engine: failed to send AI message", error);
    }
  }

  if (params.data.messageType === "file" && params.data.mediaUrl) {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);
      const result = await sendMetaWhatsAppDocumentMessage(
        {
          to: params.contactPhone,
          documentUrl: params.data.mediaUrl,
          fileName: params.data.fileName,
        },
        params.metaConfig
      );

      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: params.data.fileName || "Documento",
        type: "file",
        sender: "bot",
        media_url: params.data.mediaUrl,
        file_name: params.data.fileName,
        node_id: params.node.id,
        wa_message_id: result.messageId,
      });
    } catch (error) {
      console.error("Flow engine: failed to send document", error);
    }
  }

  if (params.data.messageType === "image") {
    try {
      await applyTypingDelay(params.inboundMessageId, typingSeconds, params.metaConfig);

      let imageUrl: string | undefined;
      const caption = params.data.imageCaption
        ? interpolateVariables(params.data.imageCaption, flowVariables)
        : undefined;

      if (params.data.imageSource === "ai_generate" && params.data.imagePrompt) {
        const interpolatedPrompt = interpolateVariables(
          params.data.imagePrompt,
          flowVariables
        );
        const b64Image = await generateAiImage(interpolatedPrompt);

        const buffer = Buffer.from(b64Image, "base64");
        const fileName = `ai-${params.conversationId}-${Date.now()}.png`;
        await params.supabase.storage
          .from("images")
          .upload(fileName, buffer, { contentType: "image/png" });

        const { data: urlData } = params.supabase.storage
          .from("images")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      } else if (params.data.mediaUrl) {
        if (params.data.mediaUrl.startsWith("data:")) {
          const base64Data = params.data.mediaUrl.split(",")[1];
          const mimeMatch = params.data.mediaUrl.match(/data:([^;]+)/);
          const contentType = mimeMatch?.[1] || "image/png";
          const ext = contentType.split("/")[1] || "png";
          const buffer = Buffer.from(base64Data!, "base64");
          const fileName = `upload-${params.conversationId}-${Date.now()}.${ext}`;
          await params.supabase.storage
            .from("images")
            .upload(fileName, buffer, { contentType });

          const { data: urlData } = params.supabase.storage
            .from("images")
            .getPublicUrl(fileName);

          imageUrl = urlData.publicUrl;
        } else {
          imageUrl = params.data.mediaUrl;
        }
      }

      if (imageUrl) {
        const result = await sendMetaWhatsAppImageMessage(
          { to: params.contactPhone, imageUrl, caption },
          params.metaConfig
        );

        await params.supabase.from("messages").insert({
          conversation_id: params.conversationId,
          content: caption || "Imagem",
          type: "image",
          sender: "bot",
          media_url: imageUrl,
          node_id: params.node.id,
          wa_message_id: result.messageId,
        });
      }
    } catch (error) {
      console.error("Flow engine: failed to send image", error);
    }
  }

}

async function executeGeneratePdfNode(params: {
  supabase: SupabaseClient;
  organizationId: string;
  metaConfig: MetaConfig;
  conversationId: string;
  contactPhone: string;
  node: FlowNode;
  data: GeneratePdfNodeData;
  inboundMessageId?: string;
}) {
  try {
    const flowVariables = await getConversationVariables(
      params.supabase,
      params.conversationId
    );

    const { data: template } = await params.supabase
      .from("pdf_templates")
      .select("html_content")
      .eq("organization_id", params.organizationId)
      .eq("id", params.data.templateId)
      .single();

    if (!template) return;

    const stravaContext = await buildStravaCoachContext(params.supabase, params.conversationId);

    const { pdf: pdfBuffer, planData, coachingSummary } = await generatePdf({
      templateHtml: template.html_content,
      flowVariables,
      aiPrompt: params.data.aiPrompt,
      stravaContext: stravaContext || undefined,
    });

    // Persist training plan, coaching summary and generation timestamp
    const updatedVars = {
      ...flowVariables,
      _training_plan: JSON.stringify(planData),
      _coaching_summary: JSON.stringify(coachingSummary),
      _plan_generated_at: new Date().toISOString(),
    };
    await params.supabase
      .from("conversations")
      .update({ flow_variables: updatedVars })
      .eq("id", params.conversationId);

    const fileName = `${params.conversationId}-${Date.now()}.pdf`;
    await params.supabase.storage
      .from("pdfs")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf" });

    const { data: urlData } = params.supabase.storage
      .from("pdfs")
      .getPublicUrl(fileName);

    if (params.inboundMessageId) {
      await sendTypingIndicator(params.inboundMessageId, params.metaConfig).catch(() => {});
    }
    // Build dynamic file name with athlete's name if available
    const athleteName = flowVariables.nome || flowVariables.onb_nome || flowVariables.flow_nome || "";
    const pdfDisplayName = athleteName
      ? `Plano de Treino - ${athleteName}.pdf`
      : (params.data.fileName || "plano-de-treino.pdf");

    const result = await sendMetaWhatsAppDocumentMessage(
      {
        to: params.contactPhone,
        documentUrl: urlData.publicUrl,
        fileName: pdfDisplayName,
      },
      params.metaConfig
    );

    await params.supabase.from("messages").insert({
      conversation_id: params.conversationId,
      content: pdfDisplayName,
      type: "file",
      sender: "bot",
      media_url: urlData.publicUrl,
      file_name: pdfDisplayName,
      node_id: params.node.id,
      wa_message_id: result.messageId,
    });
  } catch (error) {
    console.error("Flow engine: failed to generate PDF", error);
    // Notify athlete about the failure
    try {
      const errorMsg = "Houve um problema ao gerar seu plano de treino. Estamos trabalhando nisso e em breve você receberá.";
      await sendMetaWhatsAppTextMessage(
        { to: params.contactPhone, body: errorMsg },
        params.metaConfig
      );
      await params.supabase.from("messages").insert({
        conversation_id: params.conversationId,
        content: errorMsg,
        type: "text",
        sender: "bot",
        node_id: params.node.id,
      });
    } catch (msgErr) {
      console.error("Flow engine: failed to send PDF error notification", msgErr);
    }
  }
}

async function executeTagConversationNode(params: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  data: TagConversationNodeData;
}) {
  if (!params.data.tagId) return;

  const { data: tag, error: tagError } = await params.supabase
    .from("conversation_tags")
    .select("id")
    .eq("id", params.data.tagId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (tagError) {
    console.error("Flow engine: failed to load conversation tag", tagError);
    return;
  }

  if (!tag) {
    console.warn("Flow engine: tag not found for tagConversation node", {
      tagId: params.data.tagId,
      organizationId: params.organizationId,
    });
    return;
  }

  const { error: assignmentError } = await params.supabase
    .from("conversation_tag_assignments")
    .upsert(
      {
        conversation_id: params.conversationId,
        tag_id: params.data.tagId,
      },
      { onConflict: "conversation_id,tag_id" }
    );

  if (assignmentError) {
    console.error("Flow engine: failed to assign conversation tag", assignmentError);
  }
}

async function runFlowQueue(params: {
  supabase: SupabaseClient;
  organizationId: string;
  metaConfig: MetaConfig;
  conversationId: string;
  contactPhone: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  initialQueue: FlowNode[];
  inboundMessageId?: string;
  /** When resuming from an interactive sendMessage, the user's reply is
   *  carried over so a following waitForReply can capture it immediately
   *  instead of pausing and waiting for another message. */
  pendingUserAnswer?: string;
  /** Analytics tracking */
  executionId?: string | null;
  flowId?: string;
}) {
  const queue = [...params.initialQueue];
  let pendingAnswer = params.pendingUserAnswer;
  const execId = params.executionId ?? null;
  const startedAt = Date.now();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const data = current.data;

    if (shouldYieldBeforeGeneratePdf(startedAt, current, queue)) {
      return yieldFlowExecution({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        organizationId: params.organizationId,
        currentNode: current,
        remainingQueue: [current, ...queue],
      });
    }

    if (shouldYieldFlowExecution(startedAt, current)) {
      return yieldFlowExecution({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        organizationId: params.organizationId,
        currentNode: current,
        remainingQueue: [current, ...queue],
      });
    }

    // Log every node visit for analytics
    if (params.flowId) {
      logNodeEvent(params.supabase, {
        executionId: execId,
        flowId: params.flowId,
        nodeId: current.id,
        nodeType: data.type,
        conversationId: params.conversationId,
        organizationId: params.organizationId,
      });
    }

    if (data.type === "trigger") {
      queue.push(...findNextNodes(current.id, params.edges, params.nodes));
      continue;
    }

    if (data.type === "randomizer") {
      const randomizerData = data as RandomizerNodeData;
      const chosenSplitId = pickRandomPath(randomizerData.splits);
      queue.push(
        ...findNextNodes(current.id, params.edges, params.nodes, chosenSplitId)
      );
      continue;
    }

    if (data.type === "waitForReply") {
      const waitData = normalizeWaitForReplyNodeData(
        data as WaitForReplyNodeData
      );

      // If the previous node was an interactive sendMessage whose user
      // selection already provides the answer, consume it here instead of
      // pausing for another message.
      if (pendingAnswer !== undefined) {
        const matchedRoute = getMatchedWaitRoute(waitData, pendingAnswer);
        if (matchedRoute && waitData.variableName) {
          const variables = await getConversationVariables(
            params.supabase,
            params.conversationId
          );
          variables[waitData.variableName] = await buildCapturedVariableValue(
            waitData,
            pendingAnswer
          );
          await params.supabase
            .from("conversations")
            .update({ flow_variables: variables })
            .eq("id", params.conversationId);
        }
        pendingAnswer = undefined;

        const nextNodes = findNextNodesForHandleOrLegacy(
          current.id,
          params.edges,
          params.nodes,
          matchedRoute?.id
        );
        queue.push(...nextNodes);
        continue;
      }

      await sendWaitPrompt({
        supabase: params.supabase,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        nodeId: current.id,
        data: waitData,
        metaConfig: params.metaConfig,
        inboundMessageId: params.inboundMessageId,
      });

      await pauseFlow({
        supabase: params.supabase,
        conversationId: params.conversationId,
        currentNodeId: current.id,
        queue,
      });
      return "paused" as const;
    }

    if (data.type === "waitTimer") {
      const timerData = data as WaitTimerNodeData;
      const timeoutAt = new Date(
        Date.now() + (timerData.timeoutMinutes || 45) * 60 * 1000
      ).toISOString();

      await pauseFlow({
        supabase: params.supabase,
        conversationId: params.conversationId,
        currentNodeId: current.id,
        queue,
      });

      // Store the timeout deadline
      await params.supabase
        .from("conversations")
        .update({ timeout_at: timeoutAt })
        .eq("id", params.conversationId);

      return "paused" as const;
    }

    if (data.type === "waitForPlayed") {
      const playedData = data as WaitForPlayedNodeData;
      const timeoutMinutes = playedData.timeoutMinutes || 2;

      // Find the last audio message sent by the bot in this conversation
      const { data: lastAudio } = await params.supabase
        .from("messages")
        .select("wa_message_id")
        .eq("conversation_id", params.conversationId)
        .eq("sender", "bot")
        .eq("type", "audio")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const variables = await getConversationVariables(
        params.supabase,
        params.conversationId
      );
      if (lastAudio?.wa_message_id) {
        variables.__wait_played_msg_id = lastAudio.wa_message_id;
      }

      const timeoutAt = new Date(
        Date.now() + timeoutMinutes * 60 * 1000
      ).toISOString();

      await params.supabase
        .from("conversations")
        .update({ flow_variables: variables, timeout_at: timeoutAt })
        .eq("id", params.conversationId);

      await pauseFlow({
        supabase: params.supabase,
        conversationId: params.conversationId,
        currentNodeId: current.id,
        queue,
      });
      return "paused" as const;
    }

    if (data.type === "finishFlow") {
      await finalizeFlow(params.supabase, params.conversationId);
      await completeFlowExecution(params.supabase, execId, "completed");
      return "completed" as const;
    }

    if (data.type === "sendMessage") {
      // A sendMessage node means the flow is producing new output, so any
      // pending user answer from a previous interactive selection no longer
      // applies to subsequent waitForReply nodes.
      pendingAnswer = undefined;

      const sendData = data as SendMessageNodeData;

      await executeSendMessageNode({
        supabase: params.supabase,
        organizationId: params.organizationId,
        metaConfig: params.metaConfig,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        node: current,
        data: sendData,
        inboundMessageId: params.inboundMessageId,
      });

      // Interactive options (list/buttons): only pause if user's choice
      // determines the path (multiple unique next nodes). If all options
      // lead to the same node, let it flow — the next node (typically
      // waitForReply) will capture the user's selection.
      if (hasWhatsAppInteractiveOptions(sendData)) {
        const nextNodes = findNextNodes(current.id, params.edges, params.nodes);
        if (nextNodes.length > 1) {
          await pauseFlow({
            supabase: params.supabase,
            conversationId: params.conversationId,
            currentNodeId: current.id,
            queue,
          });
          return "paused" as const;
        }
      }
      // Non-interactive or single-path interactive → continues automatically

      // Keep a short ordering buffer, but avoid long gaps between audio sends.
      await delay(getPostSendDelayMs(sendData));

      // Touch updated_at so the webhook staleness check knows the flow is still active
      await params.supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", params.conversationId);
    }

    if (data.type === "tagConversation") {
      await executeTagConversationNode({
        supabase: params.supabase,
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        data: data as TagConversationNodeData,
      });
    }

    if (data.type === "generatePdf") {
      const audioWarmupPromise = prewarmUpcomingStaticAudioMedia({
        supabase: params.supabase,
        conversationId: params.conversationId,
        queue,
      });

      await executeGeneratePdfNode({
        supabase: params.supabase,
        organizationId: params.organizationId,
        metaConfig: params.metaConfig,
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        node: current,
        data: data as GeneratePdfNodeData,
        inboundMessageId: params.inboundMessageId,
      });
      // Give WhatsApp a brief settle window and let upcoming audio cache warm up.
      await Promise.race([audioWarmupPromise, delay(PDF_POST_SEND_SETTLE_MS)]);

      // Touch updated_at so the webhook staleness check knows the flow is still active
      await params.supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", params.conversationId);
    }

    if (data.type === "aiCollector") {
      const collectorData = data as AiCollectorNodeData;
      const variables = await getConversationVariables(
        params.supabase,
        params.conversationId
      );
      const interpolatedPrompt = interpolateVariables(
        collectorData.initialPrompt,
        variables
      );

      try {
        await applyTypingDelay(
          params.inboundMessageId,
          collectorData.typingSeconds,
          params.metaConfig
        );
        await sendTextAndPersist({
          supabase: params.supabase,
          conversationId: params.conversationId,
          contactPhone: params.contactPhone,
          nodeId: current.id,
          text: interpolatedPrompt,
          metaConfig: params.metaConfig,
          inboundMessageId: params.inboundMessageId,
          skipTyping: true,
        });
      } catch (error) {
        console.error("Flow engine: failed to send aiCollector prompt", error);
      }

      variables.__aiCollector_state = JSON.stringify({
        collectedFields: {},
        attemptCount: 0,
      });
      await params.supabase
        .from("conversations")
        .update({ flow_variables: variables })
        .eq("id", params.conversationId);

      await pauseFlow({
        supabase: params.supabase,
        conversationId: params.conversationId,
        currentNodeId: current.id,
        queue,
      });
      return "paused" as const;
    }

    if (data.type === "stravaConnect") {
      const stravaData = data as StravaConnectNodeData;
      try {
        const connectUrl = buildStravaConnectUrl({
          conversationId: params.conversationId,
        });

        let message: string;
        if (stravaData.messageText?.trim()) {
          message = interpolateVariables(
            stravaData.messageText.replace(/\{\{strava_link\}\}/g, connectUrl),
            await getConversationVariables(params.supabase, params.conversationId)
          );
        } else {
          message = buildStravaConnectMessage(connectUrl);
        }

        if (stravaData.ctaButtonText?.trim()) {
          // Send as interactive CTA URL button
          const bodyText = stravaData.messageText?.trim()
            ? interpolateVariables(
                stravaData.messageText.replace(/\{\{strava_link\}\}/g, "").trim(),
                await getConversationVariables(params.supabase, params.conversationId)
              )
            : "Conecte seu Strava para que eu possa acompanhar seus treinos:";

          const ctaResult = await sendMetaWhatsAppCtaUrlMessage(
            {
              to: params.contactPhone,
              bodyText,
              buttonText: stravaData.ctaButtonText,
              url: connectUrl,
            },
            params.metaConfig
          );

          await params.supabase.from("messages").insert({
            conversation_id: params.conversationId,
            content: bodyText,
            type: "interactive",
            sender: "bot",
            node_id: current.id,
            wa_message_id: ctaResult.messageId,
            metadata: { strava_connect_url: connectUrl },
          });
        } else if (stravaData.mediaUrl) {
          // Send image with the text as caption (single message)
          let imageUrl: string;
          if (stravaData.mediaUrl.startsWith("data:")) {
            const base64Data = stravaData.mediaUrl.split(",")[1];
            const mimeMatch = stravaData.mediaUrl.match(/data:([^;]+)/);
            const contentType = mimeMatch?.[1] || "image/png";
            const ext = contentType.split("/")[1] || "png";
            const buffer = Buffer.from(base64Data!, "base64");
            const fileName = `strava-${params.conversationId}-${Date.now()}.${ext}`;
            await params.supabase.storage
              .from("images")
              .upload(fileName, buffer, { contentType });
            const { data: urlData } = params.supabase.storage
              .from("images")
              .getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
          } else {
            imageUrl = stravaData.mediaUrl;
          }

          const result = await sendMetaWhatsAppImageMessage(
            { to: params.contactPhone, imageUrl, caption: message },
            params.metaConfig
          );

          await params.supabase.from("messages").insert({
            conversation_id: params.conversationId,
            content: message,
            type: "image",
            sender: "bot",
            media_url: imageUrl,
            node_id: current.id,
            wa_message_id: result.messageId,
          });
        } else {
          // No image — send text only
          await sendTextAndPersist({
            supabase: params.supabase,
            conversationId: params.conversationId,
            contactPhone: params.contactPhone,
            nodeId: current.id,
            text: message,
            metaConfig: params.metaConfig,
            inboundMessageId: params.inboundMessageId,
          });
        }
      } catch (error) {
        console.error("Flow engine: failed to send Strava connect link", error);
      }

      // Send skip button so user can continue without Strava
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const skipBody = stravaData.skipMessageText?.trim() || "Depois de conectar o Strava, vou continuar automaticamente. Se preferir, pode seguir sem:";
        const skipBtnText = stravaData.skipButtonText?.trim() || "Seguir sem Strava";
        const skipResult = await sendMetaWhatsAppInteractiveButtonsMessage(
          {
            to: params.contactPhone,
            body: skipBody,
            replyButtons: [
              { id: "strava_skip", title: skipBtnText },
            ],
          },
          params.metaConfig
        );
        await params.supabase.from("messages").insert({
          conversation_id: params.conversationId,
          content: "Seguir sem Strava?",
          type: "interactive",
          sender: "bot",
          node_id: current.id,
          wa_message_id: skipResult.messageId,
        });
      } catch (error) {
        console.error("Flow engine: failed to send Strava skip button", error);
      }

      // Pause flow — resumes when Strava callback fires or user sends message
      await pauseFlow({
        supabase: params.supabase,
        conversationId: params.conversationId,
        currentNodeId: current.id,
        queue,
      });
      return "paused" as const;
    }

    if (data.type === "payment") {
      const paymentData = data as PaymentNodeData;
      try {
        const paymentAmount = Number(paymentData.amount) || 0;
        if (paymentAmount <= 0) {
          console.error("Flow engine: Payment node has invalid amount:", paymentAmount, "— skipping. Configure a value > 0 in the node editor.");
        } else {
        const settings = await getOrganizationSettingsById(params.organizationId);
        const mpConfig = getMercadoPagoConfig(settings);

        if (!mpConfig.configured || !mpConfig.config) {
          console.error("Flow engine: Mercado Pago not configured for org", params.organizationId);
        } else {
          const result = await createPaymentAndPreference({
            supabase: params.supabase,
            organizationId: params.organizationId,
            conversationId: params.conversationId,
            planName: paymentData.planName || "Assinatura",
            amount: paymentAmount,
            durationDays: paymentData.durationDays || 30,
            currency: paymentData.currency || "BRL",
            accessToken: mpConfig.config.accessToken,
          });

          const paymentUrl = result.initPoint;
          let message: string;
          if (paymentData.messageText?.trim()) {
            message = interpolateVariables(
              paymentData.messageText.replace(/\{\{payment_link\}\}/g, paymentUrl),
              await getConversationVariables(params.supabase, params.conversationId)
            );
          } else {
            message = buildPaymentMessage(paymentUrl);
          }

          if (paymentData.ctaButtonText?.trim()) {
            // Send as interactive CTA URL button
            const bodyText = paymentData.messageText?.trim()
              ? interpolateVariables(
                  paymentData.messageText.replace(/\{\{payment_link\}\}/g, "").trim(),
                  await getConversationVariables(params.supabase, params.conversationId)
                )
              : `Para assinar o plano ${paymentData.planName || ""}, clique no botao abaixo:`.trim();

            const ctaResult = await sendMetaWhatsAppCtaUrlMessage(
              {
                to: params.contactPhone,
                bodyText,
                buttonText: paymentData.ctaButtonText,
                url: paymentUrl,
              },
              params.metaConfig
            );

            await params.supabase.from("messages").insert({
              conversation_id: params.conversationId,
              content: bodyText,
              type: "interactive",
              sender: "bot",
              node_id: current.id,
              wa_message_id: ctaResult.messageId,
              metadata: { payment_url: paymentUrl },
            });
          } else if (paymentData.mediaUrl) {
            let imageUrl: string;
            if (paymentData.mediaUrl.startsWith("data:")) {
              const base64Data = paymentData.mediaUrl.split(",")[1];
              const mimeMatch = paymentData.mediaUrl.match(/data:([^;]+)/);
              const contentType = mimeMatch?.[1] || "image/png";
              const ext = contentType.split("/")[1] || "png";
              const buffer = Buffer.from(base64Data!, "base64");
              const fileName = `payment-${params.conversationId}-${Date.now()}.${ext}`;
              await params.supabase.storage
                .from("images")
                .upload(fileName, buffer, { contentType });
              const { data: urlData } = params.supabase.storage
                .from("images")
                .getPublicUrl(fileName);
              imageUrl = urlData.publicUrl;
            } else {
              imageUrl = paymentData.mediaUrl;
            }

            const imgResult = await sendMetaWhatsAppImageMessage(
              { to: params.contactPhone, imageUrl, caption: message },
              params.metaConfig
            );

            await params.supabase.from("messages").insert({
              conversation_id: params.conversationId,
              content: message,
              type: "image",
              sender: "bot",
              media_url: imageUrl,
              node_id: current.id,
              wa_message_id: imgResult.messageId,
            });
          } else {
            await sendTextAndPersist({
              supabase: params.supabase,
              conversationId: params.conversationId,
              contactPhone: params.contactPhone,
              nodeId: current.id,
              text: message,
              metaConfig: params.metaConfig,
              inboundMessageId: params.inboundMessageId,
            });
          }
        }
        } // end: paymentAmount > 0
      } catch (error) {
        console.error("Flow engine: failed to send payment link", error);
      }
      // Delay to preserve delivery order
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (data.type === "whatsappFlow") {
      const flowData = data as WhatsAppFlowNodeData;
      try {
        let flowId = flowData.externalFlowId;

        // Builder mode: auto-create the WhatsApp Flow on Meta from screens
        if (flowData.source === "builder" && flowData.screens && flowData.screens.length > 0) {
          const { buildWhatsAppFlowJson, hashScreensConfig } = await import("@/lib/whatsapp-flow-builder");

          const screensHash = hashScreensConfig(flowData.screens);
          const variables = await getConversationVariables(params.supabase, params.conversationId);
          const cachedFlowId = variables[`__waflow_${screensHash}`];

          if (cachedFlowId) {
            // Reuse previously created flow
            flowId = cachedFlowId;
            console.log("[whatsappFlow] reusing cached flow:", flowId);
          } else {
            // Create new flow on Meta
            const flowJson = buildWhatsAppFlowJson(flowData.screens);

            const endpointUri = process.env.WHATSAPP_FLOWS_ENDPOINT_URL || undefined;

            const created = await createWhatsAppFlow(
              {
                name: `BoraRun_${flowData.label || "form"}_${screensHash}`,
                categories: ["OTHER"],
                endpointUri,
              },
              params.metaConfig
            );
            flowId = created.id;
            console.log("[whatsappFlow] created flow on Meta:", flowId);

            // Upload the JSON definition
            await updateWhatsAppFlowJson(
              flowId,
              JSON.stringify(flowJson),
              params.metaConfig
            );
            console.log("[whatsappFlow] uploaded flow JSON");

            // Publish the flow (required before sending in non-draft mode)
            if (!flowData.draftMode) {
              await publishWhatsAppFlow(flowId, params.metaConfig);
              console.log("[whatsappFlow] published flow");
            }

            // Cache the flow ID so we don't recreate on next execution
            variables[`__waflow_${screensHash}`] = flowId;
            await params.supabase
              .from("conversations")
              .update({ flow_variables: variables })
              .eq("id", params.conversationId);
          }
        }

        if (!flowId) {
          console.error("Flow engine: WhatsApp Flow node has no flowId and no builder screens — skipping.");
        } else {
          // Generate a unique flow_token that ties this response back to
          // this conversation + node so the data endpoint can resume it.
          const flowToken = `${params.conversationId}:${current.id}:${Date.now()}`;

          const variables = await getConversationVariables(
            params.supabase,
            params.conversationId
          );

          const bodyText = flowData.bodyText
            ? interpolateVariables(flowData.bodyText, variables)
            : "Preencha o formulario abaixo:";

          await sendMetaWhatsAppFlowMessage(
            {
              to: params.contactPhone,
              flowId,
              flowToken,
              headerText: flowData.headerText || undefined,
              bodyText,
              ctaText: flowData.ctaText || "Abrir formulario",
              screenId: flowData.firstScreenId || flowData.screens?.[0]?.id || "WELCOME_SCREEN",
              mode: flowData.draftMode ? "draft" : "published",
            },
            params.metaConfig
          );

          await params.supabase.from("messages").insert({
            conversation_id: params.conversationId,
            content: bodyText,
            type: "interactive",
            sender: "bot",
            node_id: current.id,
            metadata: { whatsapp_flow_id: flowId, flow_token: flowToken },
          });

          // Store the flow_token so the data endpoint can look it up
          variables.__whatsappFlow_token = flowToken;
          variables.__whatsappFlow_prefix = flowData.variablePrefix || "flow";
          await params.supabase
            .from("conversations")
            .update({ flow_variables: variables })
            .eq("id", params.conversationId);

          // Pause — the data endpoint will resume the flow when the user submits
          await pauseFlow({
            supabase: params.supabase,
            conversationId: params.conversationId,
            currentNodeId: current.id,
            queue,
          });
          return "paused" as const;
        }
      } catch (error) {
        console.error("Flow engine: failed to send WhatsApp Flow", error);
      }
    }

    queue.push(...findNextNodes(current.id, params.edges, params.nodes));
  }

  await completeFlow(params.supabase, params.conversationId);
  await completeFlowExecution(params.supabase, execId, "completed");
  return "completed" as const;
}

/**
 * Check if a message matches any active flow trigger.
 * Returns the matched flow and trigger node, or null.
 */
export async function findMatchingFlow(
  supabase: SupabaseClient,
  messageText: string,
  isNewContact: boolean,
  organizationId: string,
  conversationId: string
): Promise<{ flow: Flow; triggerNode: FlowNode } | null> {
  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (!flows || flows.length === 0) return null;

  const normalizedText = messageText.trim().toLowerCase();
  const triggerContext = await loadTriggerMatchContext(
    supabase,
    conversationId,
    organizationId
  );
  let bestMatch: { flow: Flow; triggerNode: FlowNode; priority: number } | null = null;

  for (const flow of flows as Flow[]) {
    const nodes = flow.nodes as unknown as FlowNode[];

    for (const node of nodes) {
      const data = node.data;
      if (data.type !== "trigger") continue;

      const triggerData = data as TriggerNodeData;

      if (triggerData.triggerType === "keyword" && triggerData.keyword) {
        const keywords = triggerData.keyword
          .split(",")
          .map((keyword) => keyword.trim().toLowerCase());
        const matchType = triggerData.keywordMatch || "contains";

        let matched = false;
        if (matchType === "contains") {
          matched = keywords.some((keyword) => normalizedText.includes(keyword));
        } else if (matchType === "notContains") {
          matched = keywords.every(
            (keyword) => !normalizedText.includes(keyword)
          );
        } else if (matchType === "exact") {
          matched = keywords.some((keyword) => normalizedText === keyword);
        }

        if (matched) {
          const priority = getTriggerPriority(triggerData.triggerType);
          if (!bestMatch || priority > bestMatch.priority) {
            bestMatch = { flow, triggerNode: node, priority };
          }
        }
      }

      if (triggerData.triggerType === "newContact" && isNewContact) {
        const priority = getTriggerPriority(triggerData.triggerType);
        if (!bestMatch || priority > bestMatch.priority) {
          bestMatch = { flow, triggerNode: node, priority };
        }
      }

      if (triggerData.triggerType === "tag") {
        if (!shouldApplyScopedTrigger(triggerData, isNewContact)) {
          continue;
        }

        const triggerTagId = triggerData.tagId?.trim();
        const triggerTagName = triggerData.tagName?.trim().toLowerCase();
        const matched =
          (triggerTagId && triggerContext.tagIds.has(triggerTagId)) ||
          (triggerTagName && triggerContext.tagNames.has(triggerTagName));

        if (matched) {
          const priority = getTriggerPriority(triggerData.triggerType);
          if (!bestMatch || priority > bestMatch.priority) {
            bestMatch = { flow, triggerNode: node, priority };
          }
        }
      }

      if (
        triggerData.triggerType === "subscriptionPlan" &&
        shouldApplyScopedTrigger(triggerData, isNewContact) &&
        triggerData.subscriptionPlan &&
        triggerContext.subscriptionPlan === triggerData.subscriptionPlan
      ) {
        const priority = getTriggerPriority(triggerData.triggerType);
        if (!bestMatch || priority > bestMatch.priority) {
          bestMatch = { flow, triggerNode: node, priority };
        }
      }
    }
  }

  return bestMatch
    ? { flow: bestMatch.flow, triggerNode: bestMatch.triggerNode }
    : null;
}

/**
 * Execute a flow starting from a trigger node.
 * Sends real WhatsApp messages and saves them to the database.
 */
export async function executeFlow(
  supabase: SupabaseClient,
  conversationId: string,
  contactPhone: string,
  flow: Flow,
  triggerNode: FlowNode,
  options: {
    organizationId: string;
    metaConfig: MetaConfig;
    inboundMessageId?: string;
  }
): Promise<void> {
  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];

  await supabase
    .from("conversations")
    .update({
      active_flow_id: flow.id,
      status: "running",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  const executionId = await createFlowExecution(
    supabase,
    flow.id,
    conversationId,
    options.organizationId
  );

  // Log the trigger node visit
  logNodeEvent(supabase, {
    executionId,
    flowId: flow.id,
    nodeId: triggerNode.id,
    nodeType: "trigger",
    conversationId,
    organizationId: options.organizationId,
  });

  await runFlowQueue({
    supabase,
    organizationId: options.organizationId,
    metaConfig: options.metaConfig,
    conversationId,
    contactPhone,
    nodes,
    edges,
    initialQueue: findNextNodes(triggerNode.id, edges, nodes),
    inboundMessageId: options.inboundMessageId,
    executionId,
    flowId: flow.id,
  });
}

export type ResumeFlowResult =
  | { status: "ignored" }
  | { status: "waiting" }
  | { status: "resumed" };

export async function continueFlowQueue(
  supabase: SupabaseClient,
  conversationId: string,
  contactPhone: string,
  options: {
    organizationId: string;
    metaConfig: MetaConfig;
  }
) {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("active_flow_id, flow_node_queue")
    .eq("id", conversationId)
    .single();

  if (!conversation?.active_flow_id) {
    console.log("[continueFlowQueue] ignored: no active flow", {
      conversationId,
    });
    return { status: "ignored" as const };
  }

  const queueIds = (conversation.flow_node_queue as string[]) || [];
  if (queueIds.length === 0) {
    const executionId = await findActiveExecutionId(
      supabase,
      conversation.active_flow_id as string,
      conversationId
    );
    await completeFlow(supabase, conversationId);
    await completeFlowExecution(supabase, executionId, "completed");
    return { status: "completed" as const };
  }

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", options.organizationId)
    .eq("id", conversation.active_flow_id)
    .single();

  if (!flow) {
    console.log("[continueFlowQueue] ignored: flow not found", {
      activeFlowId: conversation.active_flow_id,
      organizationId: options.organizationId,
    });
    return { status: "ignored" as const };
  }

  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];
  const initialQueue = queueIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter(Boolean) as FlowNode[];

  if (initialQueue.length === 0) {
    const executionId = await findActiveExecutionId(
      supabase,
      conversation.active_flow_id as string,
      conversationId
    );
    await completeFlow(supabase, conversationId);
    await completeFlowExecution(supabase, executionId, "completed");
    return { status: "completed" as const };
  }

  await supabase
    .from("conversations")
    .update({
      status: "running",
      current_node_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  const executionId = await findActiveExecutionId(
    supabase,
    conversation.active_flow_id as string,
    conversationId
  );

  await runFlowQueue({
    supabase,
    organizationId: options.organizationId,
    metaConfig: options.metaConfig,
    conversationId,
    contactPhone,
    nodes,
    edges,
    initialQueue,
    executionId,
    flowId: conversation.active_flow_id as string,
  });

  return { status: "continued" as const };
}

/**
 * Resume a paused flow after the user replies.
 * Saves the user's answer as a flow variable and continues execution.
 */
export async function resumeFlow(
  supabase: SupabaseClient,
  conversationId: string,
  contactPhone: string,
  userAnswer: string,
  options: {
    selectedHandleId?: string | null;
    inboundMessageId?: string;
    organizationId: string;
    metaConfig: MetaConfig;
  }
): Promise<ResumeFlowResult> {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("active_flow_id, current_node_id, flow_node_queue, flow_variables")
    .eq("id", conversationId)
    .single();

  if (!conversation?.active_flow_id || !conversation?.current_node_id) {
    console.log("[resumeFlow] ignored: no active flow or node", { conversationId });
    return { status: "ignored" };
  }

  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", options.organizationId)
    .eq("id", conversation.active_flow_id)
    .single();

  if (!flow) {
    console.log("[resumeFlow] ignored: flow not found", {
      activeFlowId: conversation.active_flow_id,
      organizationId: options.organizationId,
      flowError,
    });
    return { status: "ignored" };
  }

  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];
  const currentNode = nodes.find(
    (node) => node.id === conversation.current_node_id
  );

  if (!currentNode) {
    console.log("[resumeFlow] ignored: node not found", {
      currentNodeId: conversation.current_node_id,
    });
    return { status: "ignored" };
  }

  const variables =
    (conversation.flow_variables as Record<string, string>) || {};

  let nextFromCurrent: FlowNode[] = findNextNodes(
    currentNode.id,
    edges,
    nodes
  );

  console.log("[resumeFlow] processing", {
    nodeType: currentNode.data.type,
    nodeId: currentNode.id,
    userAnswer: userAnswer.substring(0, 50),
  });

  if (currentNode.data.type === "waitForReply") {
    const rawWaitData = currentNode.data as WaitForReplyNodeData;
    const waitData = normalizeWaitForReplyNodeData(rawWaitData);
    const matchedRoute = getMatchedWaitRoute(waitData, userAnswer);
    console.log("[resumeFlow] waitForReply route match", {
      matchedRouteId: matchedRoute?.id,
      matchType: matchedRoute?.matchType,
      variableName: waitData.variableName,
    });

    if (rawWaitData.routes && rawWaitData.routes.length > 0 && !matchedRoute) {
      const message = buildNoMatchResponseMessage(waitData);
      if (message) {
        const interpolated = interpolateVariables(message, variables);
        try {
          await sendTextAndPersist({
            supabase,
            conversationId,
            contactPhone,
            nodeId: currentNode.id,
            text: interpolated,
            metaConfig: options.metaConfig,
            inboundMessageId: options.inboundMessageId,
          });
        } catch (error) {
          console.error("Flow engine: failed to send no-match message", error);
        }
      }

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return { status: "waiting" };
    }

    if (matchedRoute && waitData.variableName) {
      variables[waitData.variableName] = await buildCapturedVariableValue(
        waitData,
        userAnswer
      );
    }

    nextFromCurrent = findNextNodesForHandleOrLegacy(
      currentNode.id,
      edges,
      nodes,
      matchedRoute?.id
    );
  } else if (currentNode.data.type === "waitTimer") {
    // User responded before timeout → follow "responded" handle, clear timeout
    await supabase
      .from("conversations")
      .update({ timeout_at: null })
      .eq("id", conversationId);

    nextFromCurrent = findNextNodes(
      currentNode.id,
      edges,
      nodes,
      "responded"
    );
  } else if (currentNode.data.type === "waitForPlayed") {
    // Clean up audio-played wait marker and timeout
    delete variables.__wait_played_msg_id;
    await supabase
      .from("conversations")
      .update({ timeout_at: null })
      .eq("id", conversationId);
  } else if (currentNode.data.type === "sendMessage") {
    const sendData = currentNode.data as SendMessageNodeData;
    const interactiveType = getSendMessageInteractiveType(sendData);
    const hasInteractiveOptions = hasWhatsAppInteractiveOptions(sendData);

    if (hasInteractiveOptions && !options.selectedHandleId) {
      const promptText =
        interactiveType === "list"
          ? "Escolha um item da lista para continuar o flow."
          : "Escolha uma das opcoes acima para continuar o flow.";

      try {
        await sendTextAndPersist({
          supabase,
          conversationId,
          contactPhone,
          nodeId: currentNode.id,
          text: promptText,
          metaConfig: options.metaConfig,
          inboundMessageId: options.inboundMessageId,
        });
      } catch (error) {
        console.error("Flow engine: failed to re-prompt interactive choice", error);
      }

      await pauseFlow({
        supabase,
        conversationId,
        currentNodeId: currentNode.id,
        queue: ((conversation.flow_node_queue as string[]) || [])
          .map((id) => nodes.find((node) => node.id === id))
          .filter(Boolean) as FlowNode[],
      });

      return { status: "waiting" };
    }

    nextFromCurrent = findNextNodesForHandleOrLegacy(
      currentNode.id,
      edges,
      nodes,
      options.selectedHandleId || undefined
    );
  } else if (currentNode.data.type === "aiCollector") {
    const collectorData = currentNode.data as AiCollectorNodeData;
    const stateRaw = variables.__aiCollector_state;
    const state = stateRaw
      ? JSON.parse(stateRaw)
      : { collectedFields: {}, attemptCount: 0 };
    state.attemptCount++;

    const extracted = await extractFieldsFromText(
      userAnswer,
      collectorData.fields,
      state.collectedFields,
      collectorData.aiExtractionPrompt
    );
    state.collectedFields = { ...state.collectedFields, ...extracted };

    const missing = getMissingFields(collectorData.fields, state.collectedFields);

    if (missing.length === 0 || state.attemptCount >= collectorData.maxAttempts) {
      // Complete — store collected fields as top-level flow variables
      for (const [key, value] of Object.entries(
        state.collectedFields as Record<string, string>
      )) {
        variables[key] = value;
      }
      delete variables.__aiCollector_state;

      if (collectorData.completionMessage) {
        const interpolated = interpolateVariables(
          collectorData.completionMessage,
          variables
        );
        try {
          await sendTextAndPersist({
            supabase,
            conversationId,
            contactPhone,
            nodeId: currentNode.id,
            text: interpolated,
            metaConfig: options.metaConfig,
            inboundMessageId: options.inboundMessageId,
          });
        } catch (error) {
          console.error("Flow engine: failed to send aiCollector completion", error);
        }
      }
      // nextFromCurrent already set — flow continues
    } else {
      // Missing fields — send follow-up and stay paused
      const followUp = buildFollowUpMessage(
        collectorData.followUpTemplate,
        missing,
        state.collectedFields
      );
      try {
        await sendTextAndPersist({
          supabase,
          conversationId,
          contactPhone,
          nodeId: currentNode.id,
          text: followUp,
          metaConfig: options.metaConfig,
          inboundMessageId: options.inboundMessageId,
        });
      } catch (error) {
        console.error("Flow engine: failed to send aiCollector follow-up", error);
      }

      variables.__aiCollector_state = JSON.stringify(state);
      await supabase
        .from("conversations")
        .update({
          flow_variables: variables,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return { status: "waiting" };
    }
  } else if (currentNode.data.type === "stravaConnect") {
    // Strava connected (via callback) or user chose to skip — just advance
    // No special variable injection needed
  } else if (currentNode.data.type === "whatsappFlow") {
    // WhatsApp Flow responses are injected into variables by the data endpoint
    // before calling resumeFlow. Clean up internal state.
    delete variables.__whatsappFlow_token;
    delete variables.__whatsappFlow_prefix;
  }

  await supabase
    .from("conversations")
    .update({
      flow_variables: variables,
      status: "running",
      current_node_id: null,
      flow_node_queue: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  const queueFromIds = ((conversation.flow_node_queue as string[]) || [])
    .map((id) => nodes.find((node) => node.id === id))
    .filter(Boolean) as FlowNode[];

  const mergedQueue = mergeQueues(nextFromCurrent, queueFromIds);

  const executionId = await findActiveExecutionId(
    supabase,
    conversation.active_flow_id as string,
    conversationId
  );

  if (mergedQueue.length === 0) {
    await completeFlow(supabase, conversationId);
    await completeFlowExecution(supabase, executionId, "completed");
    return { status: "resumed" };
  }

  // When resuming from an interactive sendMessage, carry the user's answer
  // so a directly-connected waitForReply can capture it without pausing.
  const isInteractiveSendMessage =
    currentNode.data.type === "sendMessage" &&
    hasWhatsAppInteractiveOptions(currentNode.data as SendMessageNodeData);

  await runFlowQueue({
    supabase,
    organizationId: options.organizationId,
    metaConfig: options.metaConfig,
    conversationId,
    contactPhone,
    nodes,
    edges,
    initialQueue: mergedQueue,
    inboundMessageId: options.inboundMessageId,
    pendingUserAnswer: isInteractiveSendMessage ? userAnswer : undefined,
    executionId,
    flowId: conversation.active_flow_id as string,
  });

  return { status: "resumed" };
}

/**
 * Called by the cron job when a waitTimer node's timeout expires.
 * Resumes the flow on the "no_response" handle.
 */
export async function resumeFlowOnTimeout(
  supabase: SupabaseClient,
  conversationId: string,
  contactPhone: string,
  organizationId: string,
  metaConfig: MetaConfig
) {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("active_flow_id, current_node_id, flow_node_queue, flow_variables")
    .eq("id", conversationId)
    .single();

  if (!conversation?.active_flow_id || !conversation?.current_node_id) return;

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conversation.active_flow_id)
    .single();

  if (!flow) return;

  const nodes = flow.nodes as unknown as FlowNode[];
  const edges = flow.edges as unknown as FlowEdge[];
  const currentNode = nodes.find(
    (node) => node.id === conversation.current_node_id
  );

  if (!currentNode) return;

  const isWaitTimer = currentNode.data.type === "waitTimer";
  const isWaitForPlayed = currentNode.data.type === "waitForPlayed";

  if (!isWaitTimer && !isWaitForPlayed) return;

  // Clean up wait-played marker if present
  const vars = (conversation.flow_variables as Record<string, string>) || {};
  if (isWaitForPlayed) {
    delete vars.__wait_played_msg_id;
  }

  // Clear timeout and set running
  await supabase
    .from("conversations")
    .update({
      timeout_at: null,
      status: "running",
      current_node_id: null,
      flow_node_queue: null,
      flow_variables: vars,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // waitTimer → follow "no_response" handle; waitForPlayed → follow default edges
  const nextNodes = isWaitTimer
    ? findNextNodes(currentNode.id, edges, nodes, "no_response")
    : findNextNodes(currentNode.id, edges, nodes);

  const queueFromIds = ((conversation.flow_node_queue as string[]) || [])
    .map((id) => nodes.find((node) => node.id === id))
    .filter(Boolean) as FlowNode[];

  const mergedQueue = mergeQueues(nextNodes, queueFromIds);

  const executionId = await findActiveExecutionId(
    supabase,
    conversation.active_flow_id as string,
    conversationId
  );

  if (mergedQueue.length === 0) {
    await completeFlow(supabase, conversationId);
    await completeFlowExecution(supabase, executionId, "completed");
    return;
  }

  await runFlowQueue({
    supabase,
    organizationId,
    metaConfig,
    conversationId,
    contactPhone,
    nodes,
    edges,
    initialQueue: mergedQueue,
    executionId,
    flowId: conversation.active_flow_id as string,
  });
}
