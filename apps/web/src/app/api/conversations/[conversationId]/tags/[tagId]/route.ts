import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string; tagId: string }> }
) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const { conversationId, tagId } = await params;

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

  const { error } = await supabase
    .from("conversation_tag_assignments")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("tag_id", tagId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
