import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function GET(request: Request) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key) {
    const { data, error } = await supabase
      .from("ai_guidelines")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("key", key)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
  }

  const { data, error } = await supabase
    .from("ai_guidelines")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function PUT(request: Request) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const body = await request.json();

  if (!body.key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("ai_guidelines")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("key", body.key)
    .maybeSingle();

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
      .eq("organization_id", context.organizationId)
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
      organization_id: context.organizationId,
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
