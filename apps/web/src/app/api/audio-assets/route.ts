import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createGeneratedAudioAsset } from "@/lib/audio-assets";

export async function GET() {
  try {
    const context = await getCurrentOrganizationContext();
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("audio_assets")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentOrganizationContext();
    const body = (await request.json()) as {
      text: string;
      voiceId: string;
      name: string;
    };

    if (!body.text?.trim()) {
      return NextResponse.json(
        { error: "Texto e obrigatorio" },
        { status: 400 }
      );
    }

    if (!body.voiceId) {
      return NextResponse.json(
        { error: "Voz e obrigatoria" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServerClient();
    const asset = await createGeneratedAudioAsset({
      supabase: serviceSupabase,
      organizationId: context.organizationId,
      text: body.text,
      voiceId: body.voiceId,
      name: body.name,
    });

    return NextResponse.json(
      {
        id: asset.assetId,
        name: asset.name,
        voice_name: asset.voiceName,
        source_text: body.text,
        audio_url: asset.audioUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao gerar audio";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
