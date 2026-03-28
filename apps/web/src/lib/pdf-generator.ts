import OpenAI from "openai";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import { renderPdfTemplateHtml } from "@/lib/pdf-template-renderer";
import { PLANEJADOR_INICIAL_PROMPT } from "@/lib/prompts/planejador-inicial";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION = `Você é um treinador de corrida especialista. Com base nas informações do aluno abaixo, gere um plano de treino personalizado.`;

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON válido (sem markdown, sem código, sem explicações) com EXATAMENTE 2 chaves raiz:
1. "training_plan" — com as sub-chaves: perfil_atleta, logica_plano, semanas
2. "coaching_summary" — com o resumo interno para o coach de acompanhamento`;

// Remote chromium binary for serverless (Vercel)
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar";

async function getBrowser() {
  const isLocal = !!process.env.PLAYWRIGHT_BROWSERS_PATH || process.env.NODE_ENV === "development";

  if (isLocal) {
    // Local dev: use system chromium or playwright
    try {
      const pw = await import("playwright");
      const browser = await pw.chromium.launch({ headless: true });
      return { browser, isPlaywright: true };
    } catch {
      // Fallback to puppeteer-core with local chrome
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      return { browser, isPlaywright: false };
    }
  }

  // Serverless (Vercel): use @sparticuz/chromium-min
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
    defaultViewport: { width: 794, height: 1123 },
    executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  });
  return { browser, isPlaywright: false };
}

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

  // 3. Convert HTML to PDF
  const { browser, isPlaywright } = await getBrowser();
  try {
    if (isPlaywright) {
      // Playwright path (local dev)
      const pwBrowser = browser as import("playwright").Browser;
      const page = await pwBrowser.newPage();
      await page.setViewportSize({ width: 794, height: 1123 });
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        printBackground: true,
      });
      return { pdf: Buffer.from(pdfBuffer), planData, coachingSummary };
    }

    // Puppeteer path (serverless / Vercel)
    const ppBrowser = browser as import("puppeteer-core").Browser;
    const page = await ppBrowser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "networkidle0" });
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
