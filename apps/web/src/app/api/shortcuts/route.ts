import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function GET() {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("shortcuts")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("trigger", { ascending: true });

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
    .from("shortcuts")
    .insert({
      organization_id: context.organizationId,
      trigger: body.trigger,
      content: body.content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
