import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import {
  buildStravaAuthorizeUrl,
  getStravaConfigFromSettings,
  resolveAppOrigin,
} from "@/lib/strava";

function redirectToStatus(requestUrl: string, status: string, message: string) {
  const url = new URL("/strava/connected", resolveAppOrigin(requestUrl));
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  if (!conversationId) {
    return redirectToStatus(
      request.url,
      "error",
      "conversationId obrigatorio"
    );
  }

  const supabase = createServerClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, organization_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    return redirectToStatus(
      request.url,
      "error",
      "Conversa nao encontrada"
    );
  }

  const settings = await getOrganizationSettingsById(
    conversation.organization_id as string
  );
  const { configured, missing, config } = getStravaConfigFromSettings(settings);

  if (!configured) {
    return redirectToStatus(
      request.url,
      "error",
      `Configuracao pendente: ${missing.join(", ")}`
    );
  }

  const origin = resolveAppOrigin(request.url);
  const authorizeUrl = buildStravaAuthorizeUrl({
    organizationId: conversation.organization_id as string,
    conversationId,
    origin,
    configOverride: config,
  });

  console.log("[Strava Connect] origin:", origin);
  console.log("[Strava Connect] authorize URL:", authorizeUrl.toString());
  console.log("[Strava Connect] redirect_uri:", authorizeUrl.searchParams.get("redirect_uri"));
  console.log("[Strava Connect] client_id:", authorizeUrl.searchParams.get("client_id"));

  return NextResponse.redirect(authorizeUrl);
}
