import { NextResponse } from "next/server";
import { getOrganizationSettingsById } from "@/lib/organization";
import { getMercadoPagoConfig } from "@/lib/mercado-pago";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferenceId = url.searchParams.get("preference_id");
  const orgId = url.searchParams.get("org");

  if (!preferenceId || !orgId) {
    return NextResponse.json(
      { error: "Missing preference_id or org" },
      { status: 400 }
    );
  }

  const settings = await getOrganizationSettingsById(orgId);
  const mpConfig = getMercadoPagoConfig(settings);

  if (!mpConfig.configured || !mpConfig.config) {
    return NextResponse.json(
      { error: "MercadoPago not configured" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `https://api.mercadopago.com/checkout/preferences/${preferenceId}`,
    {
      headers: {
        Authorization: `Bearer ${mpConfig.config.accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch preference" },
      { status: 502 }
    );
  }

  const preference = (await res.json()) as { init_point: string };

  return NextResponse.redirect(preference.init_point);
}
