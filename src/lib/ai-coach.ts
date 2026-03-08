import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FALLBACK_SYSTEM_PROMPT = `Você é o treinador de corrida virtual da BoraRun. Seu nome é Coach BoraRun.

Suas diretrizes:
- Você é especialista em corrida de rua, trail running, maratonas, meias-maratonas e corrida para iniciantes
- Responda sempre em português brasileiro, de forma motivadora e acolhedora
- Use uma linguagem acessível, como se estivesse falando com um amigo corredor
- Dê conselhos baseados em evidências sobre treino, nutrição para corredores, prevenção de lesões, alongamento e recuperação
- Ajude a montar planilhas de treino personalizadas quando solicitado
- Pergunte sobre o nível do corredor (iniciante, intermediário, avançado), objetivos e histórico de lesões antes de prescrever treinos
- Mantenha respostas concisas (ideal para WhatsApp) — use no máximo 3-4 parágrafos curtos
- Use emojis com moderação para manter o tom amigável
- Nunca dê diagnósticos médicos — sempre recomende procurar um profissional de saúde quando necessário
- Lembre-se do contexto da conversa para dar respostas coerentes

REGRA IMPORTANTE sobre assuntos fora do tema:
- Se o usuário falar sobre algo que NÃO seja relacionado a corrida, exercício físico, saúde esportiva ou a BoraRun, responda brevemente com contexto e redirecione de forma natural e simpática para o universo da corrida
- Nunca ignore a pessoa — sempre acolha o que ela disse antes de redirecionar
- Se ela insistir em assuntos fora do tema, seja gentil mas firme: "Entendo! Mas como treinador de corrida, posso te ajudar melhor com treinos, metas de corrida e dicas pra evoluir. Bora lá?"`;

type AiGuidelines = {
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
};

async function fetchAiGuidelines(supabase: SupabaseClient): Promise<AiGuidelines> {
  const { data } = await supabase
    .from("ai_guidelines")
    .select("system_prompt, model, temperature, max_tokens")
    .eq("key", "ai_coach")
    .single();

  if (data?.system_prompt) {
    return {
      system_prompt: data.system_prompt,
      model: data.model || "gpt-4o-mini",
      temperature: data.temperature ?? 0.7,
      max_tokens: data.max_tokens ?? 500,
    };
  }

  return {
    system_prompt: FALLBACK_SYSTEM_PROMPT,
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 500,
  };
}

interface DbMessage {
  content: string;
  sender: string;
  type: string;
  created_at: string;
}

async function buildFlowContext(supabase: SupabaseClient): Promise<string> {
  const { data: flows } = await supabase
    .from("flows")
    .select("name, nodes")
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

  return `\n\nFLOWS DISPONÍVEIS:
Existem flows automáticos que o usuário pode ativar usando palavras-chave. Se fizer sentido no contexto da conversa, mencione naturalmente essas opções:
${keywords.map((k) => `- ${k}`).join("\n")}
Exemplo: "A propósito, se quiser saber sobre [tema], é só digitar '[palavra-chave]' que te mostro tudo!"
Não force — só mencione quando for relevante para o que o usuário está falando.`;
}

export async function generateCoachResponse(
  supabase: SupabaseClient,
  conversationId: string,
  userMessage: string
): Promise<string> {
  // Fetch AI guidelines and flow context in parallel
  const [guidelines, flowContext] = await Promise.all([
    fetchAiGuidelines(supabase),
    buildFlowContext(supabase),
  ]);

  const systemPrompt = guidelines.system_prompt + flowContext;

  // Fetch conversation history for context (last 20 messages)
  const { data: history } = await supabase
    .from("messages")
    .select("content, sender, type, created_at")
    .eq("conversation_id", conversationId)
    .neq("type", "system")
    .order("created_at", { ascending: true })
    .limit(20);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of (history as DbMessage[]) || []) {
    if (msg.sender === "contact") {
      messages.push({ role: "user", content: msg.content });
    } else if (msg.sender === "bot" || msg.sender === "human") {
      messages.push({ role: "assistant", content: msg.content });
    }
  }

  // Add the current message
  messages.push({ role: "user", content: userMessage });

  const completion = await openai.chat.completions.create({
    model: guidelines.model,
    messages,
    max_tokens: guidelines.max_tokens,
    temperature: guidelines.temperature,
  });

  return completion.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta. Pode repetir?";
}
