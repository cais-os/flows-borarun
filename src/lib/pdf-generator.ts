import OpenAI from "openai";
import { chromium } from "playwright";
import { renderPdfTemplateHtml } from "@/lib/pdf-template-renderer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION = `Você é um treinador de corrida especialista. Com base nas informações do aluno abaixo, gere um plano de treino personalizado.`;

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON válido (sem markdown, sem código, sem explicações) com esta estrutura:
{
  "titulo": "Plano de Treino Personalizado",
  "subtitulo": "Descrição curta do plano",
  "aluno": {
    "resumo": "Resumo do perfil do aluno"
  },
  "semanas": [
    {
      "numero": 1,
      "foco": "Foco da semana",
      "dias": [
        {
          "dia": "Segunda",
          "treino": "Descrição do treino",
          "duracao": "30min",
          "intensidade": "Leve"
        }
      ]
    }
  ],
  "dicas": ["dica 1", "dica 2", "dica 3"],
  "observacoes": "Observações gerais"
}`;

export async function generatePdf(params: {
  templateHtml: string;
  flowVariables: Record<string, string>;
  aiPrompt?: string;
}): Promise<Buffer> {
  // 1. Generate structured plan from AI
  const variablesSummary = Object.entries(params.flowVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const instruction = (params.aiPrompt || DEFAULT_INSTRUCTION) + JSON_FORMAT_INSTRUCTION;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: `Informações do aluno:\n${variablesSummary}`,
      },
    ],
    temperature: 0.7,
  });

  const aiResponse = completion.choices[0]?.message?.content || "{}";

  // Parse JSON from AI response
  let planData: Record<string, unknown>;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    planData = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
  } catch {
    console.error("Failed to parse AI response as JSON:", aiResponse);
    planData = { error: "Falha ao gerar plano", raw: aiResponse };
  }

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
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
