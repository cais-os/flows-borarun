export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTextMessage,
  sendMetaWhatsAppInteractiveButtonsMessage,
} from "@/lib/meta";
import {
  createOrUpdateStravaConnection,
  exchangeStravaCode,
  getStravaConfigFromSettings,
  getStravaConnectionSummary,
  peekStravaState,
  resolveAppOrigin,
  syncStravaActivitiesForConversation,
  verifyStravaState,
} from "@/lib/strava";
import { getCronSecret } from "@/lib/internal-auth";

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

  // User cancelled on Strava
  if (errorParam) {
    const state = peekStravaState(url.searchParams.get("state"));
    if (state?.conversationId) {
      const supabase = createServerClient();
      const { config: metaConfig } = getMetaConfigFromSettings(settings);

      // Get contact phone
      const { data: conv } = await supabase
        .from("conversations")
        .select("contact_phone")
        .eq("id", state.conversationId)
        .single();

      if (conv?.contact_phone) {
        try {
          // Send failure message with retry/skip buttons
          await sendMetaWhatsAppInteractiveButtonsMessage(
            {
              to: conv.contact_phone,
              body: "Nao foi possivel sincronizar com o Strava. O que deseja fazer?",
              replyButtons: [
                { id: "strava_retry", title: "Tentar novamente" },
                { id: "strava_skip", title: "Seguir sem Strava" },
              ],
            },
            metaConfig
          );
        } catch (e) {
          console.error("Failed to send Strava failure buttons:", e);
        }
      }
    }

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

    const { config: metaConfig } = getMetaConfigFromSettings(settings);

    // Send success message
    try {
      const successMsg = "Sincronizacao com Strava realizada com sucesso!";
      const result = await sendMetaWhatsAppTextMessage(
        {
          to: connection.contact_phone,
          body: successMsg,
        },
        metaConfig
      );

      await supabase.from("messages").insert({
        conversation_id: state.conversationId,
        content: successMsg,
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

    // Resume the paused flow via internal endpoint so it gets its own 60s timeout
    // (fire-and-forget — don't await, so the redirect returns immediately)
    const cronSecret = getCronSecret();
    if (!cronSecret) {
      console.error("Failed to trigger flow resume: CRON_SECRET is not configured");
    } else {
      const origin = resolveAppOrigin(request.url);
      fetch(`${origin}/api/flow/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": cronSecret,
        },
        body: JSON.stringify({
          conversationId: state.conversationId,
          contactPhone: connection.contact_phone,
          userAnswer: "strava_connected",
          organizationId: previewState.organizationId,
        }),
      }).catch((err) => console.error("Failed to trigger flow resume:", err));
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

    // Try to send failure message with retry buttons
    try {
      const { config: metaConfig } = getMetaConfigFromSettings(settings);
      const { data: conv } = await supabase
        .from("conversations")
        .select("contact_phone")
        .eq("id", state.conversationId)
        .single();

      if (conv?.contact_phone) {
        await sendMetaWhatsAppInteractiveButtonsMessage(
          {
            to: conv.contact_phone,
            body: "Nao foi possivel sincronizar com Strava por problemas tecnicos. O que deseja fazer?",
            replyButtons: [
              { id: "strava_retry", title: "Tentar novamente" },
              { id: "strava_skip", title: "Seguir sem Strava" },
            ],
          },
          metaConfig
        );
      }
    } catch (btnError) {
      console.error("Failed to send Strava failure buttons:", btnError);
    }

    return redirectToStatus(
      request.url,
      "error",
      error instanceof Error ? error.message : "Falha ao conectar o Strava"
    );
  }
}
