import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();
  const { conversationId } = await params;
  const body = await request.json();

  const status = body.status as string;
  if (!status || !["active", "trial", "none"].includes(status)) {
    return NextResponse.json(
      { error: "Status deve ser 'active', 'trial' ou 'none'." },
      { status: 400 }
    );
  }

  // Verify conversation belongs to this organization
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  // Build update payload
  const update: Record<string, unknown> = {
    subscription_status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === "none") {
    update.subscription_plan = null;
    update.subscription_expires_at = null;
  } else {
    const plan = body.plan || "premium";
    const durationDays = body.durationDays || (status === "trial" ? 1 : 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    update.subscription_plan = plan;
    update.subscription_started_at = new Date().toISOString();
    update.subscription_expires_at = expiresAt.toISOString();
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", conversationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...update });
}
