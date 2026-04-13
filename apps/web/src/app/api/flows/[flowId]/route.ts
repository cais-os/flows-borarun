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

  const { data: existingFlow, error: existingError } = await supabase
    .from("flows")
    .select("name, description, is_active, nodes, edges")
    .eq("organization_id", context.organizationId)
    .eq("id", flowId)
    .single();

  if (existingError || !existingFlow) {
    return NextResponse.json(
      { error: existingError?.message || "Flow not found" },
      { status: 404 }
    );
  }

  const hasOwn = (key: string) =>
    Object.prototype.hasOwnProperty.call(body, key);

  const { data, error } = await supabase
    .from("flows")
    .update({
      name: hasOwn("name") ? body.name : existingFlow.name,
      description: hasOwn("description")
        ? body.description
        : existingFlow.description,
      is_active: hasOwn("is_active")
        ? body.is_active
        : existingFlow.is_active,
      nodes: hasOwn("nodes") ? body.nodes : existingFlow.nodes,
      edges: hasOwn("edges") ? body.edges : existingFlow.edges,
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
