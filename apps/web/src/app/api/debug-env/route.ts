import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.META_WEBHOOK_VERIFY_TOKEN;
  return NextResponse.json({
    has_token: !!token,
    token_length: token?.length || 0,
    token_value: token || "UNDEFINED",
    app_id: process.env.META_APP_ID ? "set" : "missing",
    app_secret: process.env.META_APP_SECRET ? "set" : "missing",
    system_token: process.env.META_SYSTEM_TOKEN ? "set" : "missing",
    phone_number_id: process.env.META_PHONE_NUMBER_ID ? "set" : "missing",
    waba_id: process.env.META_WABA_ID ? "set" : "missing",
    graph_api_version: process.env.META_GRAPH_API_VERSION || "missing",
  });
}
