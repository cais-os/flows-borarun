import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { getMetaConfigFromSettings, sendMetaWhatsAppTemplateMessage } from "@/lib/meta";

interface Recipient {
  phone: string;
  name?: string;
  variables?: Record<string, string>;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getCurrentOrganizationContext();
  const { config: metaConfig } = getMetaConfigFromSettings(context.settings);
  const supabase = await createSupabaseServer();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", id)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!campaign.template_name) {
    return NextResponse.json({ error: "No template selected" }, { status: 400 });
  }

  const recipients = (campaign.recipients || []) as Recipient[];

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  // Mark as sending
  await supabase
    .from("campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id);

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      // Build template components from recipient variables
      const bodyVars = campaign.body_variables as string[] || [];
      const components: Array<{
        type: string;
        parameters: Array<{ type: string; text: string }>;
      }> = [];

      if (bodyVars.length > 0) {
        const bodyParams = bodyVars.map((varName: string, index: number) => ({
          type: "text" as const,
          text:
            recipient.variables?.[varName] ||
            recipient.variables?.[`{{${index + 1}}}`] ||
            varName,
        }));

        components.push({
          type: "body",
          parameters: bodyParams,
        });
      }

      await sendMetaWhatsAppTemplateMessage({
        to: recipient.phone,
        templateName: campaign.template_name,
        language: campaign.template_language || "pt_BR",
        components: components.length > 0 ? components : undefined,
      }, metaConfig);

      sentCount++;
    } catch (err) {
      console.error(`Failed to send to ${recipient.phone}:`, err);
      failedCount++;
    }

    // Update progress every 5 messages
    if ((sentCount + failedCount) % 5 === 0) {
    await supabase
      .from("campaigns")
      .update({ sent_count: sentCount, failed_count: failedCount })
      .eq("organization_id", context.organizationId)
      .eq("id", id);
    }
  }

  // Mark as sent
  await supabase
    .from("campaigns")
    .update({
      status: failedCount === recipients.length ? "failed" : "sent",
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", context.organizationId)
    .eq("id", id);

  return NextResponse.json({ sent: sentCount, failed: failedCount });
}
