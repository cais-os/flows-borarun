import { NextResponse } from "next/server";
import { ensureStripeCheckoutForRecord } from "@/lib/stripe-payments";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentRecordId = url.searchParams.get("payment_record_id");
  const orgId = url.searchParams.get("org");

  if (!paymentRecordId || !orgId) {
    return NextResponse.json(
      { error: "Missing payment_record_id or org" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();
    const checkout = await ensureStripeCheckoutForRecord({
      supabase,
      paymentRecordId,
      organizationId: orgId,
    });

    if (!checkout.initPoint) {
      return NextResponse.json(
        { error: "Payment checkout link is not ready yet" },
        { status: 409 }
      );
    }

    return NextResponse.redirect(checkout.initPoint);
  } catch (error) {
    console.error("[stripe/retry] failed", error);
    return NextResponse.json(
      { error: "Nao foi possivel recriar o checkout agora." },
      { status: 500 }
    );
  }
}
