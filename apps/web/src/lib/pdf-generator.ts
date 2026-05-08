import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import { renderPdfTemplateHtml } from "@/lib/pdf-template-renderer";
import { generateTrainingPlanData } from "@/lib/training-plan-generator";

async function getBrowser() {
  const isLocal =
    !!process.env.PLAYWRIGHT_BROWSERS_PATH ||
    process.env.NODE_ENV === "development";

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

  // Serverless (Vercel): use @sparticuz/chromium-min with remote binary
  const executablePath = await chromium.executablePath(
    "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
  );
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 794, height: 1123 },
    executablePath,
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
  adjustmentRequest?: string;
  stravaContext?: string;
}): Promise<GeneratePdfResult> {
  // 1. Generate structured plan from AI
  const { planData, coachingSummary } = await generateTrainingPlanData({
    flowVariables: params.flowVariables,
    aiPrompt: params.aiPrompt,
    adjustmentRequest: params.adjustmentRequest,
    stravaContext: params.stravaContext,
  });

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
