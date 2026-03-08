import OpenAI from "openai";
import type { WaitForReplyNodeData } from "@/types/node-data";
import { summarizeCapturedValueLocally } from "@/lib/wait-for-reply";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSummaryInstruction(data: WaitForReplyNodeData): string {
  const customInstructions = data.aiInstructions?.trim();

  return [
    "Voce extrai o valor principal da resposta do usuario para salvar como variavel de um flow de WhatsApp.",
    "Retorne SOMENTE o dado puro, sem rotulos, sem prefixos e sem contexto extra.",
    "Exemplos: se o usuario responde 'Rodrigo', retorne 'Rodrigo'. Se responde 'quero correr 10km', retorne 'correr 10km'.",
    "Mantenha dados concretos como nomes, objetivos, distancias, prazos, numeros e restricoes.",
    "Nunca adicione prefixos como 'Nome:', 'Objetivo:', 'Resposta:' etc.",
    "Retorne apenas o texto final, sem aspas, sem markdown e sem explicacoes.",
    customInstructions || "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function buildCapturedVariableValue(
  data: WaitForReplyNodeData,
  userAnswer: string
): Promise<string> {
  const trimmedAnswer = userAnswer.trim();
  if (!trimmedAnswer) return "";

  if ((data.captureMode || "full") === "full") {
    return trimmedAnswer;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: buildSummaryInstruction(data),
        },
        {
          role: "user",
          content: [
            data.promptMessage
              ? `Pergunta do flow: "${data.promptMessage}"`
              : "",
            `Resposta do usuario: "${trimmedAnswer}"`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) return content;
  } catch (error) {
    console.error("Failed to summarize captured variable", error);
  }

  return summarizeCapturedValueLocally(trimmedAnswer);
}
