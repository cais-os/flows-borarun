import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function GET() {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { data, error } = await supabase
    .from("flows")
    .insert({
      organization_id: context.organizationId,
      name: body.name || "Novo Flow",
      description: body.description,
      is_active: body.is_active ?? false,
      nodes: body.nodes || [],
      edges: body.edges || [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
