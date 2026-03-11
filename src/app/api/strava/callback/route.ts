import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTextMessage,
} from "@/lib/meta";
import {
  buildStravaSyncMessage,
  createOrUpdateStravaConnection,
  exchangeStravaCode,
  getStravaConfigFromSettings,
  getStravaConnectionSummary,
  peekStravaState,
  resolveAppOrigin,
  syncStravaActivitiesForConversation,
  verifyStravaState,
} from "@/lib/strava";

function redirectToStatus(requestUrl: string, status: string, message: string) {
  const url = new URL("/strava/connected", resolveAppOrigin(requestUrl));
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const scope = url.searchParams.get("scope") || "";
  const previewState = peekStravaState(url.searchParams.get("state"));

  if (!previewState?.organizationId) {
    return redirectToStatus(
      request.url,
      "error",
      "Callback invalido do Strava"
    );
  }

  const settings = await getOrganizationSettingsById(previewState.organizationId);
  const { configured, missing, config } = getStravaConfigFromSettings(settings);
  if (!configured) {
    return redirectToStatus(
      request.url,
      "error",
      `Configuracao pendente: ${missing.join(", ")}`
    );
  }

  if (errorParam) {
    return redirectToStatus(
      request.url,
      "cancelled",
      "Autorizacao cancelada no Strava"
    );
  }

  const state = verifyStravaState(url.searchParams.get("state"), config);

  if (!code || !state?.conversationId) {
    return redirectToStatus(
      request.url,
      "error",
      "Callback invalido do Strava"
    );
  }

  const supabase = createServerClient();

  try {
    const exchange = await exchangeStravaCode(code, config);
    const connection = await createOrUpdateStravaConnection({
      supabase,
      conversationId: state.conversationId,
      exchange,
      scopes: scope
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });

    await syncStravaActivitiesForConversation(supabase, state.conversationId, {
      force: true,
    });

    const summary = await getStravaConnectionSummary(
      supabase,
      state.conversationId
    );
    const confirmationMessage = buildStravaSyncMessage(summary);
    const { config: metaConfig } = getMetaConfigFromSettings(settings);

    try {
      const result = await sendMetaWhatsAppTextMessage(
        {
          to: connection.contact_phone,
          body: confirmationMessage,
        },
        metaConfig
      );

      await supabase.from("messages").insert({
        conversation_id: state.conversationId,
        content: confirmationMessage,
        type: "text",
        sender: "bot",
        wa_message_id: result.messageId,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", state.conversationId);
    } catch (metaError) {
      console.error("Failed to send Strava confirmation on WhatsApp", metaError);
    }

    return redirectToStatus(
      request.url,
      "success",
      `Strava conectado com sucesso para ${
        summary.athleteName || "o atleta"
      }`
    );
  } catch (error) {
    console.error("Strava callback failed", error);
    return redirectToStatus(
      request.url,
      "error",
      error instanceof Error ? error.message : "Falha ao conectar o Strava"
    );
  }
}
