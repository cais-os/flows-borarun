import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { getStravaHealth, resolveAppOrigin } from "@/lib/strava";

export async function GET(request: Request) {
  const context = await getCurrentOrganizationContext();
  const health = getStravaHealth(context.settings);

  return NextResponse.json({
    ...health,
    callbackUrl: `${resolveAppOrigin(request.url)}${health.callbackPath}`,
  });
}
