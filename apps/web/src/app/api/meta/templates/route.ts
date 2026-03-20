import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import {
  fetchMetaMessageTemplates,
  getMetaConfigFromSettings,
} from "@/lib/meta";

export async function GET() {
  const context = await getCurrentOrganizationContext();
  const { configured, missing, config } = getMetaConfigFromSettings(
    context.settings
  );

  if (!configured) {
    return NextResponse.json(
      {
        error: "Meta Cloud API credentials not configured",
        missing,
      },
      { status: 400 }
    );
  }

  try {
    const templates = await fetchMetaMessageTemplates(config);
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch templates: ${error}` },
      { status: 500 }
    );
  }
}
