import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOrganizationSettingsById,
  type OrganizationSettings,
} from "@/lib/organization";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";
const DEFAULT_STRAVA_SCOPES = ["read", "activity:read_all"];
const STRAVA_STATE_MAX_AGE_MS = 30 * 60 * 1000;
const STRAVA_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const STRAVA_DEFAULT_STALE_MS = 6 * 60 * 60 * 1000;
const STRAVA_DEFAULT_DAYS_BACK = 120;
const STRAVA_RUN_SPORTS = new Set(["run", "trailrun", "virtualrun"]);

export type StravaConfig = {
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

type StravaOAuthState = {
  organizationId: string;
  conversationId: string;
  issuedAt: number;
};

type StravaAthlete = {
  id: number;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  profile?: string | null;
  profile_medium?: string | null;
  [key: string]: unknown;
};

type StravaTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete: StravaAthlete;
};

type StravaActivityApi = {
  id: number;
  name: string;
  type: string;
  sport_type?: string | null;
  start_date: string;
  timezone?: string | null;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_speed?: number | null;
  max_speed?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  kilojoules?: number | null;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  [key: string]: unknown;
};

type StravaConnectionRow = {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_phone: string;
  athlete_id: number;
  athlete_username: string | null;
  athlete_firstname: string | null;
  athlete_lastname: string | null;
  profile_medium: string | null;
  profile: string | null;
  scopes: string[] | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_synced_at: string | null;
  sync_status: string | null;
  last_sync_error: string | null;
  raw_athlete: Record<string, unknown> | null;
};

type StravaActivityRow = {
  strava_activity_id: number;
  name: string;
  type: string;
  sport_type: string | null;
  start_date: string;
  distance_meters: number;
  moving_time_seconds: number;
  elapsed_time_seconds: number;
  total_elevation_gain: number;
  average_speed: number | null;
  max_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
};

export type StravaIntent = "connect" | "sync";

export type StravaActivitySummary = {
  id: number;
  name: string;
  type: string;
  sportType: string | null;
  startDate: string;
  distanceKm: number;
  movingTimeSeconds: number;
  totalElevationGain: number;
  averagePace: string | null;
  averageSpeedKmh: number | null;
};

export type StravaConnectionSummary = {
  connected: boolean;
  athleteName: string | null;
  athleteUsername: string | null;
  athleteId: number | null;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  lastSyncError: string | null;
  recentActivities: StravaActivitySummary[];
};

export type StravaSyncResult = {
  connected: boolean;
  synced: boolean;
  skipped: boolean;
  athleteName: string | null;
  activityCount: number;
  runCount: number;
  lastSyncedAt: string | null;
};

function createStravaError(message: string, details?: unknown) {
  return new Error(
    details ? `${message}: ${JSON.stringify(details)}` : message
  );
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hasOrganizationStravaOverrides(settings?: OrganizationSettings | null) {
  if (!settings) return false;

  return Boolean(settings.strava_client_id || settings.strava_client_secret);
}

function createStravaConfigResult(config: StravaConfig) {
  const missing: string[] = [];
  if (!config.clientId.trim()) missing.push("STRAVA_CLIENT_ID");
  if (!config.clientSecret.trim()) missing.push("STRAVA_CLIENT_SECRET");

  return {
    configured: missing.length === 0,
    missing,
    config,
  };
}

export function getStravaConfig() {
  return createStravaConfigResult({
    clientId: process.env.STRAVA_CLIENT_ID || "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET || "",
    scopes: (process.env.STRAVA_SCOPES || DEFAULT_STRAVA_SCOPES.join(","))
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  });
}

export function getStravaConfigFromSettings(settings?: OrganizationSettings | null) {
  if (!hasOrganizationStravaOverrides(settings)) {
    return getStravaConfig();
  }

  return createStravaConfigResult({
    clientId: settings?.strava_client_id || "",
    clientSecret: settings?.strava_client_secret || "",
    scopes:
      settings?.strava_scopes?.filter(Boolean) &&
      settings.strava_scopes.length > 0
        ? settings.strava_scopes
        : DEFAULT_STRAVA_SCOPES,
  });
}

function getResolvedStravaConfig(configOverride?: StravaConfig) {
  return configOverride
    ? createStravaConfigResult(configOverride)
    : getStravaConfig();
}

export function getStravaHealth(settings?: OrganizationSettings | null) {
  const { configured, missing, config } = settings
    ? getStravaConfigFromSettings(settings)
    : getStravaConfig();

  return {
    configured,
    missing,
    scopes: config.scopes,
    callbackPath: "/api/strava/callback",
  };
}

export function resolveAppOrigin(requestUrl?: string) {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();

  if (explicitUrl) {
    return new URL(explicitUrl).origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  throw new Error(
    "Could not resolve application origin. Set NEXT_PUBLIC_APP_URL."
  );
}

export function buildStravaRedirectUri(origin: string) {
  return new URL("/api/strava/callback", origin).toString();
}

export function buildStravaConnectUrl(params: {
  conversationId: string;
  requestUrl?: string;
  origin?: string;
}) {
  const origin = params.origin || resolveAppOrigin(params.requestUrl);
  const url = new URL("/api/strava/connect", origin);
  url.searchParams.set("conversationId", params.conversationId);
  return url.toString();
}

function signStravaState(
  state: StravaOAuthState,
  configOverride?: StravaConfig
) {
  const { configured, missing, config } = getResolvedStravaConfig(configOverride);

  if (!configured) {
    throw createStravaError(`Missing Strava config: ${missing.join(", ")}`);
  }

  const payload = toBase64Url(JSON.stringify(state));
  const signature = createHmac("sha256", config.clientSecret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function peekStravaState(token: string | null) {
  if (!token) return null;

  const [payload] = token.split(".");
  if (!payload) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as Partial<StravaOAuthState>;
    if (
      !parsed.organizationId ||
      !parsed.conversationId ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }

    return {
      organizationId: parsed.organizationId,
      conversationId: parsed.conversationId,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

export function verifyStravaState(
  token: string | null,
  configOverride?: StravaConfig
): StravaOAuthState | null {
  if (!token) return null;

  const { configured, config } = getResolvedStravaConfig(configOverride);
  if (!configured) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", config.clientSecret)
    .update(payload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const parsed = JSON.parse(fromBase64Url(payload)) as Partial<StravaOAuthState>;
  if (
    !parsed.organizationId ||
    !parsed.conversationId ||
    typeof parsed.issuedAt !== "number"
  ) {
    return null;
  }

  if (Date.now() - parsed.issuedAt > STRAVA_STATE_MAX_AGE_MS) {
    return null;
  }

  return {
    organizationId: parsed.organizationId,
    conversationId: parsed.conversationId,
    issuedAt: parsed.issuedAt,
  };
}

export function buildStravaAuthorizeUrl(params: {
  organizationId: string;
  conversationId: string;
  origin: string;
  configOverride?: StravaConfig;
}) {
  const { configured, missing, config } = getResolvedStravaConfig(
    params.configOverride
  );

  if (!configured) {
    throw createStravaError(`Missing Strava config: ${missing.join(", ")}`);
  }

  const state = signStravaState(
    {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      issuedAt: Date.now(),
    },
    config
  );

  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", buildStravaRedirectUri(params.origin));
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("state", state);

  return url;
}

function normalizeIntentText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function detectStravaIntent(message: string): StravaIntent | null {
  const normalized = normalizeIntentText(message);

  const syncPattern =
    /(sincronizar|sincroniza|atualizar|atualiza).{0,20}strava|strava.{0,20}(sincronizar|sincroniza|atualizar|atualiza)/;
  if (syncPattern.test(normalized)) {
    return "sync";
  }

  const connectPattern =
    /(conectar|conecta|integrar|integra|vincular|vincula|linkar|autorizar|autoriza).{0,20}strava|strava.{0,20}(conectar|conecta|integrar|integra|vincular|vincula|linkar|autorizar|autoriza)/;
  if (connectPattern.test(normalized)) {
    return "connect";
  }

  return null;
}

async function parseStravaResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw createStravaError("Strava API request failed", data);
  }

  return data as T;
}

async function stravaTokenRequest(params: URLSearchParams) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  return parseStravaResponse<StravaTokenResponse>(response);
}

export async function exchangeStravaCode(
  code: string,
  configOverride?: StravaConfig
) {
  const { configured, missing, config } = getResolvedStravaConfig(configOverride);

  if (!configured) {
    throw createStravaError(`Missing Strava config: ${missing.join(", ")}`);
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
  });

  return stravaTokenRequest(body);
}

async function refreshStravaToken(
  refreshToken: string,
  configOverride?: StravaConfig
) {
  const { configured, missing, config } = getResolvedStravaConfig(configOverride);

  if (!configured) {
    throw createStravaError(`Missing Strava config: ${missing.join(", ")}`);
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return stravaTokenRequest(body);
}

function isRunActivity(activity: {
  type?: string | null;
  sport_type?: string | null;
}) {
  const raw = (activity.sport_type || activity.type || "").toLowerCase();
  return STRAVA_RUN_SPORTS.has(raw);
}

function getAthleteName(connection: {
  athlete_firstname?: string | null;
  athlete_lastname?: string | null;
}) {
  const fullName = [
    connection.athlete_firstname?.trim(),
    connection.athlete_lastname?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || null;
}

function formatDistanceKm(distanceMeters: number) {
  return Math.round((distanceMeters / 1000) * 10) / 10;
}

function formatSpeedKmh(speedMetersPerSecond: number | null) {
  if (!speedMetersPerSecond || speedMetersPerSecond <= 0) return null;
  return Math.round(speedMetersPerSecond * 3.6 * 10) / 10;
}

function formatPace(distanceMeters: number, movingTimeSeconds: number) {
  if (!distanceMeters || !movingTimeSeconds) return null;

  const paceSeconds = movingTimeSeconds / (distanceMeters / 1000);
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) return null;

  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}/km`;
}

function formatIsoDate(dateString: string) {
  return new Date(dateString).toISOString().slice(0, 10);
}

async function getConversationInfo(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("contact_phone, organization_id")
    .eq("id", conversationId)
    .single();

  if (error || !data?.contact_phone || !data.organization_id) {
    throw createStravaError("Conversation not found for Strava connection");
  }

  return {
    contactPhone: data.contact_phone as string,
    organizationId: data.organization_id as string,
  };
}

async function getStravaConnectionRow(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("strava_connections")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) {
    throw createStravaError("Failed to load Strava connection", error);
  }

  return (data as StravaConnectionRow | null) || null;
}

async function persistStravaConnection(params: {
  supabase: SupabaseClient;
  conversationId: string;
  organizationId: string;
  contactPhone: string;
  exchange: StravaTokenResponse;
  scopes: string[];
}) {
  const { data, error } = await params.supabase
    .from("strava_connections")
    .upsert(
      {
        organization_id: params.organizationId,
        conversation_id: params.conversationId,
        contact_phone: params.contactPhone,
        athlete_id: params.exchange.athlete.id,
        athlete_username: params.exchange.athlete.username || null,
        athlete_firstname: params.exchange.athlete.firstname || null,
        athlete_lastname: params.exchange.athlete.lastname || null,
        profile_medium: params.exchange.athlete.profile_medium || null,
        profile: params.exchange.athlete.profile || null,
        scopes: params.scopes,
        access_token: params.exchange.access_token,
        refresh_token: params.exchange.refresh_token,
        expires_at: new Date(params.exchange.expires_at * 1000).toISOString(),
        sync_status: "connected",
        last_sync_error: null,
        raw_athlete: params.exchange.athlete,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw createStravaError("Failed to save Strava connection", error);
  }

  return data as StravaConnectionRow;
}

export async function createOrUpdateStravaConnection(params: {
  supabase: SupabaseClient;
  conversationId: string;
  exchange: StravaTokenResponse;
  scopes: string[];
}) {
  const conversation = await getConversationInfo(
    params.supabase,
    params.conversationId
  );

  return persistStravaConnection({
    supabase: params.supabase,
    conversationId: params.conversationId,
    organizationId: conversation.organizationId,
    contactPhone: conversation.contactPhone,
    exchange: params.exchange,
    scopes: params.scopes,
  });
}

async function ensureFreshStravaConnection(
  supabase: SupabaseClient,
  connection: StravaConnectionRow
) {
  const expiresAt = new Date(connection.expires_at).getTime();
  if (expiresAt - Date.now() > STRAVA_REFRESH_MARGIN_MS) {
    return connection;
  }

  const settings = await getOrganizationSettingsById(connection.organization_id);
  const { config } = getStravaConfigFromSettings(settings);
  const refreshed = await refreshStravaToken(connection.refresh_token, config);

  const { data, error } = await supabase
    .from("strava_connections")
    .update({
      athlete_username: refreshed.athlete.username || null,
      athlete_firstname: refreshed.athlete.firstname || null,
      athlete_lastname: refreshed.athlete.lastname || null,
      profile_medium: refreshed.athlete.profile_medium || null,
      profile: refreshed.athlete.profile || null,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      raw_athlete: refreshed.athlete,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .select("*")
    .single();

  if (error) {
    throw createStravaError("Failed to refresh Strava token", error);
  }

  return data as StravaConnectionRow;
}

async function fetchStravaActivitiesPage(params: {
  accessToken: string;
  page: number;
  perPage: number;
  after?: number;
}) {
  const url = new URL(`${STRAVA_API_BASE_URL}/athlete/activities`);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per_page", String(params.perPage));

  if (params.after) {
    url.searchParams.set("after", String(params.after));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    cache: "no-store",
  });

  return parseStravaResponse<StravaActivityApi[]>(response);
}

async function fetchStravaActivities(params: {
  accessToken: string;
  after?: number;
  perPage?: number;
  maxPages?: number;
}) {
  const perPage = params.perPage ?? 50;
  const maxPages = params.maxPages ?? 3;
  const activities: StravaActivityApi[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const currentPage = await fetchStravaActivitiesPage({
      accessToken: params.accessToken,
      after: params.after,
      page,
      perPage,
    });

    activities.push(...currentPage);

    if (currentPage.length < perPage) {
      break;
    }
  }

  return activities;
}

function mapApiActivityToRow(
  activity: StravaActivityApi,
  connection: StravaConnectionRow
) {
  return {
    organization_id: connection.organization_id,
    conversation_id: connection.conversation_id,
    connection_id: connection.id,
    strava_activity_id: activity.id,
    name: activity.name,
    type: activity.type,
    sport_type: activity.sport_type || null,
    start_date: activity.start_date,
    timezone: activity.timezone || null,
    distance_meters: activity.distance || 0,
    moving_time_seconds: activity.moving_time || 0,
    elapsed_time_seconds: activity.elapsed_time || 0,
    total_elevation_gain: activity.total_elevation_gain || 0,
    average_speed: activity.average_speed ?? null,
    max_speed: activity.max_speed ?? null,
    average_heartrate: activity.average_heartrate ?? null,
    max_heartrate: activity.max_heartrate ?? null,
    average_cadence: activity.average_cadence ?? null,
    kilojoules: activity.kilojoules ?? null,
    trainer: activity.trainer ?? false,
    commute: activity.commute ?? false,
    manual: activity.manual ?? false,
    raw_payload: activity,
    synced_at: new Date().toISOString(),
  };
}

export async function syncStravaActivitiesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  options?: {
    force?: boolean;
    staleAfterMs?: number;
    daysBack?: number;
    maxPages?: number;
    perPage?: number;
  }
): Promise<StravaSyncResult> {
  const existingConnection = await getStravaConnectionRow(supabase, conversationId);
  if (!existingConnection) {
    return {
      connected: false,
      synced: false,
      skipped: true,
      athleteName: null,
      activityCount: 0,
      runCount: 0,
      lastSyncedAt: null,
    };
  }

  const staleAfterMs = options?.staleAfterMs ?? STRAVA_DEFAULT_STALE_MS;
  const lastSyncedAtMs = existingConnection.last_synced_at
    ? new Date(existingConnection.last_synced_at).getTime()
    : 0;

  if (
    !options?.force &&
    lastSyncedAtMs > 0 &&
    Date.now() - lastSyncedAtMs < staleAfterMs
  ) {
    return {
      connected: true,
      synced: false,
      skipped: true,
      athleteName: getAthleteName(existingConnection),
      activityCount: 0,
      runCount: 0,
      lastSyncedAt: existingConnection.last_synced_at,
    };
  }

  let connection = await ensureFreshStravaConnection(supabase, existingConnection);

  try {
    const after =
      Math.floor(Date.now() / 1000) -
      (options?.daysBack ?? STRAVA_DEFAULT_DAYS_BACK) * 24 * 60 * 60;

    const activities = await fetchStravaActivities({
      accessToken: connection.access_token,
      after,
      maxPages: options?.maxPages,
      perPage: options?.perPage,
    });

    if (activities.length > 0) {
      const { error: upsertError } = await supabase
        .from("strava_activities")
        .upsert(
          activities.map((activity) => mapApiActivityToRow(activity, connection)),
          { onConflict: "conversation_id,strava_activity_id" }
        );

      if (upsertError) {
        throw createStravaError(
          "Failed to persist Strava activities",
          upsertError
        );
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("strava_connections")
      .update({
        last_synced_at: now,
        sync_status: "synced",
        last_sync_error: null,
        updated_at: now,
      })
      .eq("id", connection.id)
      .select("*")
      .single();

    if (error) {
      throw createStravaError(
        "Failed to update Strava sync timestamp",
        error
      );
    }

    connection = data as StravaConnectionRow;

    return {
      connected: true,
      synced: true,
      skipped: false,
      athleteName: getAthleteName(connection),
      activityCount: activities.length,
      runCount: activities.filter(isRunActivity).length,
      lastSyncedAt: connection.last_synced_at,
    };
  } catch (error) {
    await supabase
      .from("strava_connections")
      .update({
        sync_status: "error",
        last_sync_error:
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    throw error;
  }
}

function mapActivityRowToSummary(activity: StravaActivityRow): StravaActivitySummary {
  return {
    id: activity.strava_activity_id,
    name: activity.name,
    type: activity.type,
    sportType: activity.sport_type,
    startDate: activity.start_date,
    distanceKm: formatDistanceKm(activity.distance_meters),
    movingTimeSeconds: activity.moving_time_seconds,
    totalElevationGain: activity.total_elevation_gain,
    averagePace: formatPace(
      activity.distance_meters,
      activity.moving_time_seconds
    ),
    averageSpeedKmh: formatSpeedKmh(activity.average_speed),
  };
}

export async function getStravaConnectionSummary(
  supabase: SupabaseClient,
  conversationId: string,
  options?: { limit?: number }
): Promise<StravaConnectionSummary> {
  const connection = await getStravaConnectionRow(supabase, conversationId);

  if (!connection) {
    return {
      connected: false,
      athleteName: null,
      athleteUsername: null,
      athleteId: null,
      lastSyncedAt: null,
      syncStatus: null,
      lastSyncError: null,
      recentActivities: [],
    };
  }

  const { data: activities, error } = await supabase
    .from("strava_activities")
    .select(
      "strava_activity_id, name, type, sport_type, start_date, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain, average_speed, max_speed, average_heartrate, max_heartrate"
    )
    .eq("conversation_id", conversationId)
    .order("start_date", { ascending: false })
    .limit(options?.limit ?? 6);

  if (error) {
    throw createStravaError("Failed to load Strava activities", error);
  }

  return {
    connected: true,
    athleteName: getAthleteName(connection),
    athleteUsername: connection.athlete_username,
    athleteId: connection.athlete_id,
    lastSyncedAt: connection.last_synced_at,
    syncStatus: connection.sync_status,
    lastSyncError: connection.last_sync_error,
    recentActivities: ((activities as StravaActivityRow[] | null) || []).map(
      mapActivityRowToSummary
    ),
  };
}

export function buildStravaConnectMessage(connectUrl: string) {
  return [
    "Para conectar seu Strava e eu ajustar melhor seus treinos, toque neste link:",
    connectUrl,
    "",
    "Depois da autorizacao eu consigo considerar suas corridas recentes, volume e frequencia nas recomendacoes.",
  ].join("\n");
}

export function buildStravaSyncMessage(summary: StravaConnectionSummary) {
  const latestRun = summary.recentActivities.find((activity) =>
    isRunActivity({
      type: activity.type,
      sport_type: activity.sportType,
    })
  );

  if (!latestRun) {
    return "Sincronizei seu Strava. Ainda nao encontrei corridas recentes para usar nas recomendacoes.";
  }

  const paceText = latestRun.averagePace
    ? ` com pace medio de ${latestRun.averagePace}`
    : "";

  return `Sincronizei seu Strava. Sua corrida mais recente foi ${latestRun.distanceKm.toFixed(
    1
  )} km em ${formatIsoDate(latestRun.startDate)}${paceText}.`;
}

export async function buildStravaCoachContext(
  supabase: SupabaseClient,
  conversationId: string
) {
  try {
    await syncStravaActivitiesForConversation(supabase, conversationId).catch(
      (error) => {
        console.error("Failed to sync Strava context", error);
      }
    );

    const connection = await getStravaConnectionRow(supabase, conversationId);
    if (!connection) return "";

    const cutoff = new Date(
      Date.now() - 42 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: activityRows, error } = await supabase
      .from("strava_activities")
      .select(
        "strava_activity_id, name, type, sport_type, start_date, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain, average_speed, max_speed, average_heartrate, max_heartrate"
      )
      .eq("conversation_id", conversationId)
      .gte("start_date", cutoff)
      .order("start_date", { ascending: false })
      .limit(18);

    if (error) {
      throw createStravaError("Failed to build Strava coach context", error);
    }

    const runs = ((activityRows as StravaActivityRow[] | null) || []).filter(
      isRunActivity
    );

    if (runs.length === 0) {
      return `\n\nCONTEXTO STRAVA:\n- Conta conectada para ${getAthleteName(
        connection
      ) || "o atleta"}, mas nao ha corridas recentes sincronizadas.\n- Se fizer sentido, confirme se a conta esta ativa antes de prescrever volume.`;
    }

    const totalKm =
      Math.round(
        runs.reduce((sum, run) => sum + run.distance_meters, 0) / 100
      ) / 10;
    const weeklyKm = Math.round((totalKm / 6) * 10) / 10;
    const longestRun = runs.reduce((longest, run) =>
      run.distance_meters > longest.distance_meters ? run : longest
    );
    const latestRun = runs[0];
    const recentLines = runs
      .slice(0, 4)
      .map((run) => {
        const pace = formatPace(run.distance_meters, run.moving_time_seconds);
        const paceSuffix = pace ? ` | pace ${pace}` : "";
        return `- ${formatIsoDate(run.start_date)} | ${formatDistanceKm(
          run.distance_meters
        ).toFixed(1)} km${paceSuffix}`;
      })
      .join("\n");

    return [
      "",
      "",
      "CONTEXTO STRAVA:",
      `- Atleta conectado: ${getAthleteName(connection) || "sem nome"}${
        connection.athlete_username ? ` (@${connection.athlete_username})` : ""
      }.`,
      `- Ultimos 42 dias: ${runs.length} corridas e ${totalKm.toFixed(
        1
      )} km totais.`,
      `- Media semanal aproximada: ${weeklyKm.toFixed(1)} km.`,
      `- Longao recente: ${formatDistanceKm(longestRun.distance_meters).toFixed(
        1
      )} km em ${formatIsoDate(longestRun.start_date)}.`,
      `- Ultima corrida: ${formatDistanceKm(latestRun.distance_meters).toFixed(
        1
      )} km em ${formatIsoDate(latestRun.start_date)}${
        formatPace(latestRun.distance_meters, latestRun.moving_time_seconds)
          ? ` com pace medio de ${formatPace(
              latestRun.distance_meters,
              latestRun.moving_time_seconds
            )}`
          : ""
      }.`,
      "- Corridas recentes:",
      recentLines,
      "- Use esses dados para ajustar volume, frequencia, longao e recuperacao.",
    ].join("\n");
  } catch (error) {
    console.error("Failed to prepare Strava coach context", error);
    return "";
  }
}
