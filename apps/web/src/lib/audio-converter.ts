/**
 * Converts audio files to OGG/OPUS format using Convertio API.
 * This ensures audio messages appear as voice notes (PTT) on WhatsApp
 * instead of forwarded audio files.
 */

const CONVERTIO_API = "https://api.convertio.co/convert";

function getApiKey(): string {
  const key = process.env.CONVERTIO_API_KEY;
  if (!key) throw new Error("CONVERTIO_API_KEY is not configured");
  return key;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert an audio buffer (MP3, WAV, etc.) to OGG/OPUS format.
 * Returns the converted buffer or the original if conversion fails/unnecessary.
 */
export async function convertToOgg(
  audioBuffer: Buffer,
  sourceFormat: string
): Promise<Buffer> {
  // Already OGG — no conversion needed
  if (sourceFormat === "ogg" || sourceFormat === "opus") {
    return audioBuffer;
  }

  const apiKey = getApiKey();

  // Step 1: Start conversion with base64 input
  const base64Content = audioBuffer.toString("base64");

  const startRes = await fetch(CONVERTIO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      input: "base64",
      file: base64Content,
      filename: `audio.${sourceFormat}`,
      outputformat: "ogg",
    }),
  });

  const startData = (await startRes.json()) as {
    status: string;
    data?: { id: string };
    error?: string;
  };

  if (startData.status !== "ok" || !startData.data?.id) {
    console.error("[audio-converter] Failed to start conversion:", startData.error);
    return audioBuffer; // Fallback: return original
  }

  const conversionId = startData.data.id;

  // Step 2: Poll for completion (max 30 seconds)
  for (let i = 0; i < 15; i++) {
    await sleep(2000);

    const statusRes = await fetch(`${CONVERTIO_API}/${conversionId}/status`);
    const statusData = (await statusRes.json()) as {
      status: string;
      data?: { step: string; step_percent?: number };
      error?: string;
    };

    if (statusData.status !== "ok") {
      console.error("[audio-converter] Status check failed:", statusData.error);
      return audioBuffer;
    }

    if (statusData.data?.step === "finish") {
      break;
    }

    if (statusData.data?.step === "error") {
      console.error("[audio-converter] Conversion failed");
      return audioBuffer;
    }
  }

  // Step 3: Download converted file
  const dlRes = await fetch(`${CONVERTIO_API}/${conversionId}/dl`);
  const dlData = (await dlRes.json()) as {
    status: string;
    data?: { content: string };
    error?: string;
  };

  if (dlData.status !== "ok" || !dlData.data?.content) {
    console.error("[audio-converter] Download failed:", dlData.error);
    return audioBuffer;
  }

  console.log("[audio-converter] Successfully converted to OGG");
  return Buffer.from(dlData.data.content, "base64");
}

/**
 * Detect audio format from content type or file extension.
 */
export function getAudioFormat(contentType: string, fileName?: string): string {
  if (contentType.includes("ogg") || contentType.includes("opus")) return "ogg";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a";
  if (contentType.includes("aac")) return "aac";
  if (contentType.includes("webm")) return "webm";

  // Fallback: check file extension
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (ext) return ext;

  return "mp3"; // Default assumption
}

/**
 * Check if audio needs conversion to OGG for WhatsApp voice notes.
 */
export function needsOggConversion(contentType: string, fileName?: string): boolean {
  const format = getAudioFormat(contentType, fileName);
  return format !== "ogg" && format !== "opus";
}
