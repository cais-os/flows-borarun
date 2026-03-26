import type { SupabaseClient } from "@supabase/supabase-js";
import { ELEVENLABS_VOICES, generateSpeech } from "@/lib/elevenlabs";

export async function createGeneratedAudioAsset(params: {
  supabase: SupabaseClient;
  organizationId: string;
  text: string;
  voiceId: string;
  name?: string;
  persistRecord?: boolean;
}) {
  const trimmedText = params.text.trim();
  if (!trimmedText) {
    throw new Error("Texto e obrigatorio");
  }

  if (!params.voiceId) {
    throw new Error("Voz e obrigatoria");
  }

  const voice = ELEVENLABS_VOICES.find((item) => item.id === params.voiceId);
  const voiceName = voice?.name || "Voz personalizada";
  const resolvedName = params.name?.trim() || `Audio - ${voiceName}`;
  const audioBuffer = await generateSpeech(trimmedText, params.voiceId);
  // Use OGG format so WhatsApp displays as voice note (PTT)
  const storagePath = `${params.organizationId}/${crypto.randomUUID()}.ogg`;

  const { error: uploadError } = await params.supabase.storage
    .from("audio")
    .upload(storagePath, audioBuffer, {
      contentType: "audio/ogg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = params.supabase.storage.from("audio").getPublicUrl(storagePath);

  let assetId: string | undefined;

  if (params.persistRecord !== false) {
    const { data: asset, error: insertError } = await params.supabase
      .from("audio_assets")
      .insert({
        organization_id: params.organizationId,
        name: resolvedName,
        voice_id: params.voiceId,
        voice_name: voiceName,
        source_text: trimmedText,
        audio_url: publicUrl,
        file_size_bytes: audioBuffer.length,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    assetId = asset.id as string;
  }

  return {
    assetId,
    audioUrl: publicUrl,
    name: resolvedName,
    voiceName,
  };
}
