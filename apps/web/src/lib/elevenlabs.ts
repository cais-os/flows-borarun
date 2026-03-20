export const ELEVENLABS_VOICES = [
  { id: "ybT9EL9NMy8gLjKo6TCr", name: "Voz Principal" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Feminina)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Masculina)" },
  { id: "ylxSgmyq2AjVVFMI0oUR", name: "Coach BoraRun" },
] as const;

export type ElevenLabsVoiceId = (typeof ELEVENLABS_VOICES)[number]["id"];

export async function generateSpeech(
  text: string,
  voiceId: string
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
