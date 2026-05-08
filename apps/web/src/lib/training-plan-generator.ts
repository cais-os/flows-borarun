import OpenAI from "openai";
import { PLANEJADOR_INICIAL_PROMPT } from "@/lib/prompts/planejador-inicial";
import { normalizeTrainingPlan } from "@/lib/training-plan";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION = `Voce e um treinador de corrida especialista. Com base nas informacoes do aluno abaixo, gere um plano de treino personalizado.`;

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON valido (sem markdown, sem codigo, sem explicacoes) com EXATAMENTE 2 chaves raiz:
1. "training_plan" - com as sub-chaves: perfil_atleta, logica_plano, semanas
2. "coaching_summary" - com o resumo interno para o coach de acompanhamento`;

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
  const variablesSummary = Object.entries(params.flowVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return params.stravaContext
    ? `Informacoes do aluno:\n${variablesSummary}\n\nDados do Strava:\n${params.stravaContext}`
    : `Informacoes do aluno:\n${variablesSummary}`;
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
    model: "gpt-5.4-mini",
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
