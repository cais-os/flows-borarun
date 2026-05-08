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
  const baseUrl = params.baseUrl.replace(/\/+$/, "");
  const normalizedPhone = normalizeRunnerPhone(params.phone);

  return `${baseUrl}/plano/${normalizedPhone}`;
}
