import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import {
  getMetaConfigFromSettings,
  subscribeMetaAppToWaba,
} from "@/lib/meta";

export async function POST() {
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
    const result = await subscribeMetaAppToWaba(config);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to subscribe app to WABA: ${error}` },
      { status: 500 }
    );
  }
}
