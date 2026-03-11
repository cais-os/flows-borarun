import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const { conversationId } = await params;
  const body = await request.json();
  const tagId = String(body.tagId || "").trim();

  if (!tagId) {
    return NextResponse.json(
      { error: "O tagId e obrigatorio." },
      { status: 400 }
    );
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  const { data: tag, error: tagError } = await supabase
    .from("conversation_tags")
    .select("id")
    .eq("id", tagId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (tagError) {
    return NextResponse.json({ error: tagError.message }, { status: 500 });
  }

  if (!tag) {
    return NextResponse.json({ error: "Tag nao encontrada." }, { status: 404 });
  }

  const { error } = await supabase
    .from("conversation_tag_assignments")
    .upsert(
      {
        conversation_id: conversationId,
        tag_id: tagId,
      },
      { onConflict: "conversation_id,tag_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
