import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getOrganizationSettingsById,
} from "@/lib/organization";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTemplateMessage,
} from "@/lib/meta";
import { validateCronAuthorization } from "@/lib/internal-auth";

interface Recipient {
  phone: string;
  name?: string;
  variables?: Record<string, string>;
}

export async function GET(request: Request) {
  const auth = validateCronAuthorization(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createServerClient();

  // Find scheduled campaigns whose time has arrived
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results: Array<{ id: string; sent: number; failed: number }> = [];

  for (const campaign of campaigns) {
    if (!campaign.template_name) continue;
    const settings = await getOrganizationSettingsById(
      campaign.organization_id as string
    );
    const { config: metaConfig } = getMetaConfigFromSettings(settings);

    const recipients = (campaign.recipients || []) as Recipient[];
    if (recipients.length === 0) continue;

    // Mark as sending
    await supabase
      .from("campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const bodyVars = (campaign.body_variables as string[]) || [];
        const components: Array<{
          type: string;
          parameters: Array<{ type: string; text: string }>;
        }> = [];

        if (bodyVars.length > 0) {
          components.push({
            type: "body",
            parameters: bodyVars.map((varName: string, index: number) => ({
              type: "text" as const,
              text:
                recipient.variables?.[varName] ||
                recipient.variables?.[`{{${index + 1}}}`] ||
                varName,
            })),
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

      if ((sentCount + failedCount) % 5 === 0) {
        await supabase
          .from("campaigns")
          .update({ sent_count: sentCount, failed_count: failedCount })
          .eq("id", campaign.id);
      }
    }

    await supabase
      .from("campaigns")
      .update({
        status: failedCount === recipients.length ? "failed" : "sent",
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    results.push({ id: campaign.id, sent: sentCount, failed: failedCount });
  }

  return NextResponse.json({ processed: results.length, results });
}
