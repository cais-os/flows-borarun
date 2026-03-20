import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const { tagId } = await params;

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
    .from("conversation_tags")
    .delete()
    .eq("id", tagId)
    .eq("organization_id", context.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
