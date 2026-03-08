import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key) {
    const { data, error } = await supabase
      .from("ai_guidelines")
      .select("*")
      .eq("key", key)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
  }

  const { data, error } = await supabase
    .from("ai_guidelines")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function PUT(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();

  if (!body.key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("ai_guidelines")
    .select("id")
    .eq("key", body.key)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("ai_guidelines")
      .update({
        system_prompt: body.system_prompt,
        model: body.model,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("ai_guidelines")
    .insert({
      key: body.key,
      system_prompt: body.system_prompt,
      model: body.model,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
