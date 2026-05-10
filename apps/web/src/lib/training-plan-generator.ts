import OpenAI from "openai";
import { PLANEJADOR_INICIAL_PROMPT } from "@/lib/prompts/planejador-inicial";
import { normalizeTrainingPlan } from "@/lib/training-plan";
import { DEFAULT_TRAINING_PLAN_MODEL } from "@/lib/ai-models";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION = `Você é um treinador de corrida especialista. Com base nas informações do aluno abaixo, gere um plano de treino personalizado.`;

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON válido (sem markdown, sem código, sem explicações) com EXATAMENTE 2 chaves raiz:
1. "training_plan" — com as sub-chaves: perfil_atleta, logica_plano, semanas
2. "coaching_summary" — com o resumo interno para o coach de acompanhamento`;

export type TrainingPlanGenerationResult = {
  planData: Record<string, unknown>;
  coachingSummary: Record<string, unknown>;
};

function parseJsonResponse(aiResponse: string): Record<string, unknown> {
  try {
    return JSON.parse(aiResponse);
  } catch {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    try {
      return JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch {
      console.error("Failed to parse AI response as JSON:", aiResponse);
      return { error: "Falha ao gerar plano", raw: aiResponse };
    }
  }
}

export function buildTrainingPlanUserContent(params: {
  flowVariables: Record<string, string>;
  stravaContext?: string;
}) {
  let variablesSummary = Object.entries(params.flowVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const startDate = params.flowVariables.data_inicio_plano?.slice(0, 10);
  const calendarContext =
    startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? `\n\nContexto de calendario do plano:\ndata_inicio_plano: ${startDate}\nNao planeje treinos antes de ${startDate}. Se essa data cair no meio ou no fim da semana, a primeira semana pode ter menos treinos do que a frequencia semanal informada. A partir da segunda semana, siga a frequencia semanal normal.`
      : "";
  variablesSummary = `${variablesSummary}${calendarContext}`;

  const baseContent = `InformaÃ§Ãµes do aluno:\n${variablesSummary}${calendarContext}`;

  void baseContent;

  return params.stravaContext
    ? `Informações do aluno:\n${variablesSummary}\n\nDados do Strava:\n${params.stravaContext}`
    : `Informações do aluno:\n${variablesSummary}`;
}

export function parseTrainingPlanCompletion(
  aiResponse: string,
  options?: {
    flowVariables?: Record<string, string>;
  }
): TrainingPlanGenerationResult {
  const parsed = parseJsonResponse(aiResponse);
  const rawPlanData =
    (parsed.training_plan as Record<string, unknown> | undefined) || parsed;
  const planData = normalizeTrainingPlan(rawPlanData, {
    flowVariables: options?.flowVariables,
  });
  const coachingSummary =
    (parsed.coaching_summary as Record<string, unknown> | undefined) || {};

  return { planData, coachingSummary };
}

export async function generateTrainingPlanData(params: {
  flowVariables: Record<string, string>;
  aiPrompt?: string;
  adjustmentRequest?: string;
  stravaContext?: string;
}): Promise<TrainingPlanGenerationResult> {
  const usePlanejadorPrompt = !params.aiPrompt;
  const baseInstruction = usePlanejadorPrompt
    ? PLANEJADOR_INICIAL_PROMPT + JSON_FORMAT_INSTRUCTION
    : (params.aiPrompt || DEFAULT_INSTRUCTION) + JSON_FORMAT_INSTRUCTION;
  const adjustmentInstruction = params.adjustmentRequest?.trim()
    ? `\n\nAJUSTE SOLICITADO PELO USUARIO:\n${params.adjustmentRequest.trim()}\n\nGere uma nova versao do plano incorporando esse pedido de forma coerente, segura e personalizada. Preserve o restante do contexto sempre que fizer sentido e mantenha o foco em treinos de corrida.`
    : "";
  const instruction = `${baseInstruction}${adjustmentInstruction}`;

  const completion = await openai.chat.completions.create({
    model: DEFAULT_TRAINING_PLAN_MODEL,
    messages: [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: buildTrainingPlanUserContent({
          flowVariables: params.flowVariables,
          stravaContext: params.stravaContext,
        }),
      },
    ],
    response_format: { type: "json_object" },
  });

  const aiResponse = completion.choices[0]?.message?.content || "{}";
  return parseTrainingPlanCompletion(aiResponse, {
    flowVariables: params.flowVariables,
  });
}
