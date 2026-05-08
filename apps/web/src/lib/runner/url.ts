import { normalizeRunnerPhone } from "@/lib/runner/phone";

export function getRunnerAppBaseUrl(requestOrigin?: string) {
  return (
    process.env.RUNNER_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_RUNNER_APP_BASE_URL ||
    requestOrigin ||
    ""
  ).replace(/\/+$/, "");
}

export function buildRunnerPlanUrl(params: { baseUrl: string; phone: string }) {
  const baseUrl = params.baseUrl.trim().replace(/\/+$/, "");
  let parsedBaseUrl: URL;

  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error("Runner plan URL requires an absolute http(s) base URL.");
  }

  if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
    throw new Error("Runner plan URL requires an absolute http(s) base URL.");
  }

  const normalizedPhone = normalizeRunnerPhone(params.phone);

  return `${baseUrl}/plano/${normalizedPhone}`;
}
