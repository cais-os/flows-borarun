import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: body.name,
      template_name: body.template_name || null,
      template_id: body.template_id || null,
      template_language: body.template_language || "pt_BR",
      body_variables: body.body_variables || [],
      header_variables: body.header_variables || [],
      recipients: body.recipients || [],
      total_recipients: body.recipients?.length || 0,
      status: body.status || "draft",
      scheduled_at: body.scheduled_at || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
