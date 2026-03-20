import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { fetchMetaHealth, getMetaConfigFromSettings } from "@/lib/meta";

export async function GET() {
  const context = await getCurrentOrganizationContext();
  const { configured, missing, config } = getMetaConfigFromSettings(
    context.settings
  );

  if (!configured) {
    return NextResponse.json(
      {
        configured: false,
        missing,
      },
      { status: 400 }
    );
  }

  try {
    const health = await fetchMetaHealth(config);
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
