import OpenAI from "openai";
import type { AiCollectorField } from "@/types/node-data";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractFieldsFromText(
  text: string,
  fields: AiCollectorField[],
  alreadyCollected: Record<string, string>,
  customPrompt?: string
): Promise<Record<string, string>> {
  const fieldDescriptions = fields
    .map((f) => `- ${f.name}: ${f.description}${f.required ? " (obrigatorio)" : " (opcional)"}`)
    .join("\n");

  const collectedSummary = Object.entries(alreadyCollected)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const systemPrompt = [
    "Voce e um assistente de extracao de dados. Dado o texto do usuario e os campos abaixo, extraia os valores encontrados.",
    "Retorne APENAS um JSON valido com os nomes dos campos como chaves e os valores extraidos como strings.",
    "So inclua campos que voce encontrou com confianca no texto. Retorne {} se nada foi encontrado.",
    "Nao invente dados. Nao inclua campos que nao estao no texto.",
    customPrompt ? `\nInstrucoes adicionais: ${customPrompt}` : "",
  ].join("\n");

  const userPrompt = [
    `Campos para extrair:\n${fieldDescriptions}`,
    collectedSummary ? `\nJa coletados (nao precisa re-extrair):\n${collectedSummary}` : "",
    `\nTexto do usuario: "${text}"`,
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const result: Record<string, string> = {};

    const validFieldNames = new Set(fields.map((f) => f.name));
    for (const [key, value] of Object.entries(parsed)) {
      if (validFieldNames.has(key) && value != null && String(value).trim() !== "") {
        result[key] = String(value).trim();
      }
    }

    return result;
  } catch (error) {
    console.error("[ai-collector] extraction failed:", error);
    return {};
  }
}

export function getMissingFields(
  fields: AiCollectorField[],
  collected: Record<string, string>
): AiCollectorField[] {
  return fields.filter((f) => f.required && !collected[f.name]);
}

export function buildFollowUpMessage(
  template: string,
  missingFields: AiCollectorField[],
  collected: Record<string, string>
): string {
  const missingList = missingFields.map((f) => f.description).join(", ");
  const collectedList = Object.entries(collected)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return template
    .replace(/\{\{missing_fields\}\}/g, missingList)
    .replace(/\{\{collected_summary\}\}/g, collectedList || "nenhum ainda");
}
