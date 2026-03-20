import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Classify whether a user message is a direct answer to a flow question
 * or an off-topic question/comment.
 */
export async function classifyFlowIntent(
  promptMessage: string,
  userMessage: string
): Promise<"ANSWER" | "OFF_TOPIC"> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content:
            "Você é um classificador de intenção. O flow de conversa fez uma pergunta ao usuário. " +
            "Determine se a resposta do usuário é uma RESPOSTA à pergunta ou se é OFF_TOPIC (fora do assunto). " +
            "Responda apenas ANSWER ou OFF_TOPIC.",
        },
        {
          role: "user",
          content: `Pergunta do flow: "${promptMessage}"\nResposta do usuário: "${userMessage}"`,
        },
      ],
    });

    const result = response.choices[0]?.message?.content?.trim().toUpperCase();
    if (result?.includes("OFF_TOPIC")) return "OFF_TOPIC";
    return "ANSWER";
  } catch (error) {
    console.error("Intent classifier error:", error);
    // Default to ANSWER so the flow doesn't get stuck
    return "ANSWER";
  }
}
