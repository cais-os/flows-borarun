import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { normalizeConversationTagName } from "@/lib/conversation-tags";

export async function GET() {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("conversation_tags")
    .select("id, name, created_at")
    .eq("organization_id", context.organizationId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const body = await request.json();
  const name = normalizeConversationTagName(String(body.name || ""));

  if (!name) {
    return NextResponse.json(
      { error: "O nome da tag e obrigatorio." },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("conversation_tags")
    .select("id, name, created_at")
    .eq("organization_id", context.organizationId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json(existing);
  }

  const { data, error } = await supabase
    .from("conversation_tags")
    .insert({
      organization_id: context.organizationId,
      name,
    })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
