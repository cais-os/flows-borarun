import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStravaCoachContext } from "@/lib/strava";
import { COACH_ACOMPANHAMENTO_PROMPT } from "@/lib/prompts/coach-acompanhamento";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiGuidelines = {
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
};

interface DbMessage {
  content: string;
  sender: string;
  type: string;
  created_at: string;
}

interface ConversationData {
  flow_variables: Record<string, string> | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
}

// ---------------------------------------------------------------------------
// AI guidelines (org-level overrides)
// ---------------------------------------------------------------------------

async function fetchAiGuidelines(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AiGuidelines> {
  const { data } = await supabase
    .from("ai_guidelines")
    .select("system_prompt, model, temperature, max_tokens")
    .eq("organization_id", organizationId)
    .eq("key", "ai_coach")
    .maybeSingle();

  if (data?.system_prompt) {
    return {
      system_prompt: data.system_prompt,
      model: data.model || "gpt-5.4-mini",
      temperature: data.temperature ?? 0.7,
      max_tokens: data.max_tokens ?? 1000,
    };
  }

  return {
    system_prompt: COACH_ACOMPANHAMENTO_PROMPT,
    model: "gpt-5.4-mini",
    temperature: 0.7,
    max_tokens: 1000,
  };
}

// ---------------------------------------------------------------------------
// Flow context (available keyword triggers)
// ---------------------------------------------------------------------------

async function buildFlowContext(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const { data: flows } = await supabase
    .from("flows")
    .select("name, nodes")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (!flows || flows.length === 0) return "";

  const keywords: string[] = [];
  for (const flow of flows) {
    const nodes = (flow.nodes as Array<{ data: { type: string; triggerType?: string; keyword?: string } }>) || [];
    for (const node of nodes) {
      if (node.data.type === "trigger" && node.data.triggerType === "keyword" && node.data.keyword) {
        keywords.push(`"${node.data.keyword}" (flow: ${flow.name})`);
      }
    }
  }

  if (keywords.length === 0) return "";

  return `\n\n=== FLOWS DISPONÍVEIS ===
Existem flows automáticos que o usuário pode ativar usando palavras-chave. Se fizer sentido no contexto da conversa, mencione naturalmente essas opções:
${keywords.map((k) => `- ${k}`).join("\n")}
Não force — só mencione quando for relevante.`;
}

// ---------------------------------------------------------------------------
// Company context
// ---------------------------------------------------------------------------

async function buildCompanyContext(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const { data } = await supabase
    .from("ai_guidelines")
    .select("system_prompt")
    .eq("organization_id", organizationId)
    .eq("key", "company_info")
    .maybeSingle();

  if (!data?.system_prompt) return "";

  try {
    const info = JSON.parse(data.system_prompt);
    const lines: string[] = [];
    if (info.name) lines.push(`Nome: ${info.name}`);
    if (info.site) lines.push(`Site: ${info.site}`);
    if (info.instagram) lines.push(`Instagram: ${info.instagram}`);
    if (info.phone) lines.push(`Telefone/WhatsApp: ${info.phone}`);
    if (info.email) lines.push(`E-mail: ${info.email}`);
    if (info.description) lines.push(`Sobre: ${info.description}`);
    if (info.extra) lines.push(`Informações extras: ${info.extra}`);

    if (lines.length === 0) return "";

    return `\n\n=== EMPRESA ===\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Current week context (calculates which week the athlete is on)
// ---------------------------------------------------------------------------

function getNowBrazil(): Date {
  // Use Brazil timezone (UTC-3) for date calculations
  const now = new Date();
  const brStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brStr);
}

function buildCurrentWeekContext(vars: Record<string, string>): string {
  const planRaw = vars._training_plan;
  const generatedAt = vars._plan_generated_at;
  if (!planRaw || !generatedAt) return "";

  try {
    const plan = typeof planRaw === "string" ? JSON.parse(planRaw) : planRaw;
    const semanas = plan.semanas as Array<{
      numero: number;
      fase?: string;
      foco?: string;
      volume_total_km?: number;
      dias?: Array<Record<string, unknown>>;
    }>;
    if (!semanas || semanas.length === 0) return "";

    const startDate = new Date(generatedAt);
    const now = getNowBrazil();
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.floor(diffDays / 7) + 1;

    const dayNames = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
    const todayName = dayNames[now.getDay()];

    const lines: string[] = [
      `\n\n=== PLANO DE TREINO ATIVO ===`,
      `Plano gerado em: ${new Date(generatedAt).toLocaleDateString("pt-BR")}`,
    ];

    // Detect expired plan
    if (weekNumber > semanas.length) {
      lines.push(`ATENÇÃO: O plano de ${semanas.length} semanas EXPIROU (estamos na semana ${weekNumber}).`);
      lines.push("Sugira ao atleta gerar um novo plano atualizado.");
      lines.push(`Hoje é ${todayName}.`);
      return lines.join("\n");
    }

    lines.push(`Semana atual: ${weekNumber} de ${semanas.length}`);

    const currentWeek = semanas.find((s) => s.numero === weekNumber) || semanas[semanas.length - 1];
    const nextWeek = semanas.find((s) => s.numero === weekNumber + 1);

    if (currentWeek) {
      if (currentWeek.fase) lines.push(`Fase: ${currentWeek.fase}`);
      if (currentWeek.foco) lines.push(`Foco: ${currentWeek.foco}`);
      if (currentWeek.volume_total_km) lines.push(`Volume planejado: ${currentWeek.volume_total_km} km`);
      lines.push(`Hoje é ${todayName}.`);
      if (currentWeek.dias) {
        lines.push("\nTreinos desta semana:");
        for (const dia of currentWeek.dias) {
          const d = dia as Record<string, string>;
          lines.push(`- ${d.dia_semana || d.dia}: ${d.descricao || d.treino || d.tipo} ${d.rpe ? `(RPE ${d.rpe})` : ""}`);
        }
      }
    }

    if (nextWeek) {
      lines.push("\nPróxima semana:");
      if (nextWeek.fase) lines.push(`Fase: ${nextWeek.fase}`);
      if (nextWeek.foco) lines.push(`Foco: ${nextWeek.foco}`);
      if (nextWeek.volume_total_km) lines.push(`Volume planejado: ${nextWeek.volume_total_km} km`);
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Coaching summary context (handoff from plan generator)
// ---------------------------------------------------------------------------

function buildCoachingSummaryContext(vars: Record<string, string>): string {
  const raw = vars._coaching_summary;
  if (!raw) return "";

  try {
    const summary = typeof raw === "string" ? JSON.parse(raw) : raw;
    const lines: string[] = ["\n\n=== RESUMO INTERNO DO PLANEJADOR ==="];

    for (const [key, value] of Object.entries(summary)) {
      if (value && String(value).trim()) {
        const label = key.replace(/_/g, " ");
        lines.push(`- ${label}: ${value}`);
      }
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// User profile context (onboarding data + subscription)
// ---------------------------------------------------------------------------

function buildUserProfileContext(vars: Record<string, string>, conv: ConversationData): string {
  // Only show onboarding/flow variables, not internal system fields
  const allowedPrefixes = ["onb_", "flow_", "lead_"];
  const profileVars = Object.entries(vars).filter(
    ([k]) => !k.startsWith("_") && (allowedPrefixes.some((p) => k.startsWith(p)) || !k.includes("_"))
  );
  const lines: string[] = [];

  if (profileVars.length > 0) {
    lines.push("\n\n=== DADOS DO ATLETA (ONBOARDING) ===");
    for (const [k, v] of profileVars) {
      if (v && String(v).trim()) {
        lines.push(`- ${k}: ${v}`);
      }
    }
  }

  lines.push("\n\n=== ASSINATURA ===");
  lines.push(`Plano: ${conv.subscription_plan || "nenhum"}`);
  lines.push(`Status: ${conv.subscription_status || "none"}`);
  if (conv.subscription_expires_at) {
    lines.push(`Validade: ${new Date(conv.subscription_expires_at).toLocaleDateString("pt-BR")}`);
  }

  if (conv.subscription_status === "trial") {
    lines.push("\nIMPORTANTE - PERÍODO DE TESTE: Este aluno está em teste gratuito. Responda com qualidade, mas mencione naturalmente os benefícios do premium (ajustes semanais, análise do Strava, acompanhamento contínuo). Seja sutil.");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Profile update instruction (appended to system prompt)
// ---------------------------------------------------------------------------

const PROFILE_UPDATE_INSTRUCTION = `

=== ATUALIZAÇÃO DE PERFIL ===
Se durante esta interação você identificar algo que mude o perfil do atleta (ex: nova lesão, mudança de nível, mudança de objetivo, nova restrição, melhora significativa), retorne no FINAL da sua resposta, em uma linha separada, o marcador <<<PROFILE_UPDATE>>> seguido de um JSON com APENAS os campos que mudaram.

Exemplo: se o atleta relata dor no joelho:
<<<PROFILE_UPDATE>>>{"principais_restricoes":"dor no joelho direito reportada","sinais_de_alerta":"monitorar dor no joelho, reduzir impacto se persistir"}

Regras:
- Só inclua o marcador se houver mudança REAL no perfil
- Inclua APENAS os campos que mudaram (merge parcial)
- Na maioria das mensagens NÃO haverá atualização — não force
- O marcador NÃO é visível para o atleta — é processado internamente`;

// ---------------------------------------------------------------------------
// Parse AI response: separate visible message from profile updates
// ---------------------------------------------------------------------------

const PROFILE_UPDATE_MARKER = "<<<PROFILE_UPDATE>>>";

export type CoachResponse = {
  message: string;
  profileUpdates?: Record<string, unknown>;
};

// Fields the AI coach is allowed to update
const ALLOWED_PROFILE_FIELDS = new Set([
  "nivel_do_atleta",
  "risco",
  "objetivo",
  "foco_do_ciclo",
  "agressividade_do_plano",
  "dias_de_corrida_por_semana",
  "treino_chave_1",
  "treino_chave_2",
  "longao",
  "intensidade_permitida",
  "principais_restricoes",
  "sinais_de_alerta",
  "estilo_de_progressao",
  "criterio_para_subir_carga",
  "criterio_para_manter_carga",
  "criterio_para_reduzir_carga",
  "observacoes_importantes_para_o_coach",
]);

// Risk levels ordered from least to most severe — never downgrade
const RISK_LEVELS = ["baixo", "moderado", "alto"];

export function validateProfileUpdates(
  updates: Record<string, unknown>,
  currentSummary: Record<string, unknown>
): Record<string, unknown> | null {
  const validated: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_PROFILE_FIELDS.has(key)) continue;

    // Prevent risk downgrade (e.g., "alto" → "baixo")
    if (key === "risco" && typeof value === "string") {
      const currentRisk = String(currentSummary.risco || "baixo");
      const currentIdx = RISK_LEVELS.indexOf(currentRisk);
      const newIdx = RISK_LEVELS.indexOf(value);
      if (newIdx < currentIdx) continue; // block downgrade
    }

    validated[key] = value;
  }

  return Object.keys(validated).length > 0 ? validated : null;
}

function parseCoachResponse(raw: string): CoachResponse {
  const markerIndex = raw.indexOf(PROFILE_UPDATE_MARKER);
  if (markerIndex === -1) {
    return { message: raw.trim() };
  }

  const message = raw.substring(0, markerIndex).trim();
  const jsonStr = raw.substring(markerIndex + PROFILE_UPDATE_MARKER.length).trim();

  try {
    const profileUpdates = JSON.parse(jsonStr);
    return { message, profileUpdates };
  } catch {
    return { message };
  }
}

// ---------------------------------------------------------------------------
// Main: generate coach response
// ---------------------------------------------------------------------------

export async function generateCoachResponse(
  supabase: SupabaseClient,
  conversationId: string,
  userMessage: string,
  organizationId: string
): Promise<CoachResponse> {
  // Fetch conversation data
  const { data: conv } = await supabase
    .from("conversations")
    .select("flow_variables, subscription_status, subscription_plan, subscription_expires_at")
    .eq("id", conversationId)
    .single();

  const vars = (conv?.flow_variables as Record<string, string>) || {};
  const convData = conv as ConversationData || {
    flow_variables: null,
    subscription_status: null,
    subscription_plan: null,
    subscription_expires_at: null,
  };

  // Build all context pieces in parallel
  const [guidelines, flowContext, stravaContext, companyContext] = await Promise.all([
    fetchAiGuidelines(supabase, organizationId),
    buildFlowContext(supabase, organizationId),
    buildStravaCoachContext(supabase, conversationId),
    buildCompanyContext(supabase, organizationId),
  ]);

  // Build synchronous context from flow_variables
  const userProfile = buildUserProfileContext(vars, convData);
  const coachingSummary = buildCoachingSummaryContext(vars);
  const currentWeek = buildCurrentWeekContext(vars);

  // Assemble system prompt
  const systemPrompt = [
    guidelines.system_prompt,
    userProfile,
    coachingSummary,
    currentWeek,
    stravaContext,
    companyContext,
    flowContext,
    PROFILE_UPDATE_INSTRUCTION,
  ]
    .filter(Boolean)
    .join("");

  // Fetch conversation history (last 50 messages for multi-week context)
  const { data: history } = await supabase
    .from("messages")
    .select("content, sender, type, created_at")
    .eq("conversation_id", conversationId)
    .neq("type", "system")
    .order("created_at", { ascending: true })
    .limit(50);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of (history as DbMessage[]) || []) {
    if (msg.sender === "contact") {
      messages.push({ role: "user", content: msg.content });
    } else if (msg.sender === "bot" || msg.sender === "human") {
      messages.push({ role: "assistant", content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  const completion = await openai.chat.completions.create({
    model: guidelines.model,
    messages,
    max_tokens: guidelines.max_tokens,
    temperature: guidelines.temperature,
  });

  const rawResponse = completion.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta. Pode repetir?";
  return parseCoachResponse(rawResponse);
}
