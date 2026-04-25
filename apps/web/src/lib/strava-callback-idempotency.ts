import type { SupabaseClient } from "@supabase/supabase-js";

export const STRAVA_SUCCESS_MESSAGE =
  "Sincronizacao com Strava realizada com sucesso!";

export const STRAVA_SUCCESS_DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000;

export type StravaSuccessMessageProbe = {
  content: string | null;
  sender: string | null;
  created_at: string | null;
};

export function shouldSendStravaSuccessMessage(
  recentMessages: StravaSuccessMessageProbe[],
  nowMs = Date.now(),
  windowMs = STRAVA_SUCCESS_DEDUPLICATION_WINDOW_MS
) {
  return !recentMessages.some((message) => {
    if (
      message.sender !== "bot" ||
      message.content !== STRAVA_SUCCESS_MESSAGE ||
      !message.created_at
    ) {
      return false;
    }

    const createdAtMs = new Date(message.created_at).getTime();
    return Number.isFinite(createdAtMs) && nowMs - createdAtMs <= windowMs;
  });
}

export async function shouldSendStravaSuccessMessageForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  nowMs = Date.now()
) {
  const cutoff = new Date(
    nowMs - STRAVA_SUCCESS_DEDUPLICATION_WINDOW_MS
  ).toISOString();

  const { data, error } = await supabase
    .from("messages")
    .select("content,sender,created_at")
    .eq("conversation_id", conversationId)
    .eq("sender", "bot")
    .eq("content", STRAVA_SUCCESS_MESSAGE)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return shouldSendStravaSuccessMessage(
    (data as StravaSuccessMessageProbe[] | null) || [],
    nowMs
  );
}
