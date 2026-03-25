import OpenAI from "openai";
import { chromium } from "playwright";
import { renderPdfTemplateHtml } from "@/lib/pdf-template-renderer";
import { PLANEJADOR_INICIAL_PROMPT } from "@/lib/prompts/planejador-inicial";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION = `Você é um treinador de corrida especialista. Com base nas informações do aluno abaixo, gere um plano de treino personalizado.`;

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON válido (sem markdown, sem código, sem explicações) com EXATAMENTE 2 chaves raiz:
1. "training_plan" — com as sub-chaves: perfil_atleta, logica_plano, semanas
2. "coaching_summary" — com o resumo interno para o coach de acompanhamento`;

export type GeneratePdfResult = {
  pdf: Buffer;
  planData: Record<string, unknown>;
  coachingSummary: Record<string, unknown>;
};

export async function generatePdf(params: {
  templateHtml: string;
  flowVariables: Record<string, string>;
  aiPrompt?: string;
  stravaContext?: string;
}): Promise<GeneratePdfResult> {
  // 1. Generate structured plan from AI
  const variablesSummary = Object.entries(params.flowVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const usePlanejadorPrompt = !params.aiPrompt;
  const instruction = usePlanejadorPrompt
    ? PLANEJADOR_INICIAL_PROMPT + JSON_FORMAT_INSTRUCTION
    : (params.aiPrompt || DEFAULT_INSTRUCTION) + JSON_FORMAT_INSTRUCTION;

  const userContent = params.stravaContext
    ? `Informações do aluno:\n${variablesSummary}\n\nDados do Strava:\n${params.stravaContext}`
    : `Informações do aluno:\n${variablesSummary}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    response_format: { type: "json_object" },
  });

  const aiResponse = completion.choices[0]?.message?.content || "{}";

  // Parse JSON from AI response
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(aiResponse);
  } catch {
    // Fallback: try to extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch {
      console.error("Failed to parse AI response as JSON:", aiResponse);
      parsed = { error: "Falha ao gerar plano", raw: aiResponse };
    }
  }

  // Extract the two root keys
  const planData = (parsed.training_plan as Record<string, unknown>) || parsed;
  const coachingSummary = (parsed.coaching_summary as Record<string, unknown>) || {};

  // 2. Interpolate template with AI-generated data + flow variables
  const html = renderPdfTemplateHtml({
    templateHtml: params.templateHtml,
    flowVariables: params.flowVariables,
    aiData: planData,
  });

  // 3. Convert HTML to PDF with Playwright
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
      printBackground: true,
    });
    return { pdf: Buffer.from(pdfBuffer), planData, coachingSummary };
  } finally {
    await browser.close();
  }
}
