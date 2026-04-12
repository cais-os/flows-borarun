export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  decryptFlowRequest,
  encryptFlowResponse,
  resolveWhatsAppFlowsPrivateKey,
} from "@/lib/whatsapp-flow-crypto";
import { resumeFlow } from "@/lib/flow-engine";
import { getMetaConfigFromSettings } from "@/lib/meta";
import { getOrganizationSettingsById } from "@/lib/organization";

const PRIVATE_KEY = resolveWhatsAppFlowsPrivateKey();

/**
 * WhatsApp Flows Data Endpoint.
 *
 * Meta POSTs encrypted form submissions here. We decrypt, store the
 * captured fields as flow variables, and resume the paused flow.
 *
 * Expected encrypted payload (after decryption):
 * {
 *   version: "3.0",
 *   action: "data_exchange" | "ping" | "INIT",
 *   screen: "SCREEN_ID",
 *   data: { field_name: "value", ... },
 *   flow_token: "conversationId:nodeId:timestamp"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!PRIVATE_KEY) {
      console.error("[whatsapp-flow] WHATSAPP_FLOWS_PRIVATE_KEY not configured");
      return NextResponse.json(
        { error: "Endpoint not configured" },
        { status: 500 }
      );
    }

    // Decrypt the request
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptFlowRequest(
      body,
      PRIVATE_KEY
    );

    const action = decryptedBody.action as string;
    const flowToken = decryptedBody.flow_token as string | undefined;

    console.log("[whatsapp-flow] received action:", action, "token:", flowToken);

    // Handle health-check / ping
    if (action === "ping") {
      const response = { data: { status: "active" } };
      return new NextResponse(
        encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    // Handle INIT — return initial screen data if needed
    if (action === "INIT") {
      const response = {
        screen: decryptedBody.screen || "WELCOME_SCREEN",
        data: {},
      };
      return new NextResponse(
        encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    // Handle data_exchange — the user navigated between screens
    if (action === "data_exchange") {
      const screen = decryptedBody.screen as string | undefined;

      // If this is not the final screen, just acknowledge
      // (you can add multi-screen routing here if needed)
      const response = {
        screen: screen || "SUCCESS_SCREEN",
        data: {},
      };
      return new NextResponse(
        encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    // Handle COMPLETE — the user submitted the flow
    if (action === "complete" || action === "COMPLETE") {
      const data = (decryptedBody.data || {}) as Record<string, string>;

      // Parse the flow_token to find the conversation
      if (!flowToken) {
        console.error("[whatsapp-flow] No flow_token in completed flow");
        const response = { screen: "SUCCESS_SCREEN", data: {} };
        return new NextResponse(
          encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
          { headers: { "Content-Type": "text/plain" } }
        );
      }

      const [conversationId] = flowToken.split(":");

      if (!conversationId) {
        console.error("[whatsapp-flow] Invalid flow_token:", flowToken);
        const response = { screen: "SUCCESS_SCREEN", data: {} };
        return new NextResponse(
          encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
          { headers: { "Content-Type": "text/plain" } }
        );
      }

      // Store captured data and resume the flow in the background
      // (we must respond to Meta quickly)
      resumeFlowFromWhatsAppFlow(conversationId, data).catch((err) =>
        console.error("[whatsapp-flow] background resume failed:", err)
      );

      // Acknowledge to Meta
      const response = { screen: "SUCCESS_SCREEN", data: {} };
      return new NextResponse(
        encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    // Unknown action — just acknowledge
    const response = { data: {} };
    return new NextResponse(
      encryptFlowResponse(response, aesKeyBuffer, ivBuffer),
      { headers: { "Content-Type": "text/plain" } }
    );
  } catch (error) {
    console.error("[whatsapp-flow] endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Resume the paused BoraRun flow after WhatsApp Flow form submission.
 * Injects captured fields as flow variables with the configured prefix.
 */
async function resumeFlowFromWhatsAppFlow(
  conversationId: string,
  formData: Record<string, string>
) {
  const supabase = createServerClient();

  // Get conversation to find org + flow variables
  const { data: conversation } = await supabase
    .from("conversations")
    .select("organization_id, contact_phone, flow_variables")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    console.error("[whatsapp-flow] conversation not found:", conversationId);
    return;
  }

  const variables =
    (conversation.flow_variables as Record<string, string>) || {};
  const prefix = variables.__whatsappFlow_prefix || "flow";

  // Inject form data as prefixed flow variables
  for (const [key, value] of Object.entries(formData)) {
    variables[`${prefix}_${key}`] = String(value);
  }

  // Also store the raw response object for downstream nodes
  variables[`${prefix}_response`] = JSON.stringify(formData);

  // Update variables before resuming
  await supabase
    .from("conversations")
    .update({ flow_variables: variables })
    .eq("id", conversationId);

  // Resolve Meta config for the org
  const settings = await getOrganizationSettingsById(
    conversation.organization_id
  );
  const { config: metaConfig } = getMetaConfigFromSettings(settings);

  // Resume the flow — the user answer is a serialized summary
  const answerSummary = Object.entries(formData)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  await resumeFlow(
    supabase,
    conversationId,
    conversation.contact_phone,
    answerSummary,
    {
      organizationId: conversation.organization_id,
      metaConfig,
    }
  );
}
