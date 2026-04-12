import { NextResponse } from "next/server";
import {
  getCurrentOrganizationContext,
  upsertCurrentOrganizationSettings,
} from "@/lib/organization";

export async function GET() {
  try {
    const context = await getCurrentOrganizationContext();
    if (context.role !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can manage settings" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      organizationId: context.organizationId,
      organizationName: context.organizationName,
      role: context.role,
      userEmail: context.user.email || null,
      settings: context.settings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load settings",
      },
      { status: 401 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getCurrentOrganizationContext();
    if (context.role !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can manage settings" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    const saved = await upsertCurrentOrganizationSettings({
      full_name: (body.full_name as string) || null,
      phone: (body.phone as string) || null,
      email: (body.email as string) || null,
      subscription_plan:
        body.subscription_plan === "premium" ? "premium" : "free",
      business_name: (body.business_name as string) || null,
      business_phone: (body.business_phone as string) || null,
      meta_phone_number_id: (body.meta_phone_number_id as string) || null,
      meta_waba_id: (body.meta_waba_id as string) || null,
      meta_app_id: (body.meta_app_id as string) || null,
      meta_app_secret: (body.meta_app_secret as string) || null,
      meta_system_token: (body.meta_system_token as string) || null,
      meta_webhook_verify_token:
        (body.meta_webhook_verify_token as string) || null,
      meta_graph_api_version:
        (body.meta_graph_api_version as string) || "v23.0",
      strava_client_id: (body.strava_client_id as string) || null,
      strava_client_secret: (body.strava_client_secret as string) || null,
      strava_scopes: Array.isArray(body.strava_scopes)
        ? (body.strava_scopes as string[])
        : ["read", "activity:read_all"],
      mercado_pago_access_token:
        (body.mercado_pago_access_token as string) || null,
      mercado_pago_public_key:
        (body.mercado_pago_public_key as string) || null,
      mercado_pago_webhook_secret:
        (body.mercado_pago_webhook_secret as string) || null,
      subscription_nudge_message:
        (body.subscription_nudge_message as string) || null,
    });

    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}
