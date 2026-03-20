import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params;
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", flowId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params;
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { data, error } = await supabase
    .from("flows")
    .update({
      name: body.name,
      description: body.description,
      is_active: body.is_active ?? false,
      nodes: body.nodes,
      edges: body.edges,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", context.organizationId)
    .eq("id", flowId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params;
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();

  const { error } = await supabase
    .from("flows")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("id", flowId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
