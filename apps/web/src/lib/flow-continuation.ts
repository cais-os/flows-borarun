import { getCronSecret } from "@/lib/internal-auth";
import { resolveAppOrigin } from "@/lib/strava";

type ContinuationFetchResponse = Pick<Response, "ok" | "status" | "text">;

type ContinuationFetch = (
  input: string,
  init: RequestInit
) => Promise<ContinuationFetchResponse>;

type FlowContinuationParams = {
  conversationId: string;
  contactPhone: string;
  organizationId: string;
};

type FlowContinuationDependencies = {
  fetchImpl?: ContinuationFetch;
  getSecret?: () => string | null;
  resolveOrigin?: () => string;
  signal?: AbortSignal;
};

export async function triggerFlowContinuation(
  params: FlowContinuationParams,
  dependencies: FlowContinuationDependencies = {}
) {
  const secret = dependencies.getSecret ? dependencies.getSecret() : getCronSecret();
  if (!secret) {
    console.error("[flow-engine] CRON_SECRET is not configured; cannot continue flow");
    return false;
  }

  let origin: string;
  try {
    origin = dependencies.resolveOrigin
      ? dependencies.resolveOrigin()
      : resolveAppOrigin();
  } catch (error) {
    console.error("[flow-engine] failed to resolve app origin for continuation", error);
    return false;
  }

  const fetchImpl = dependencies.fetchImpl || fetch;
  const signal =
    dependencies.signal ||
    (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(10_000)
      : undefined);

  try {
    const response = await fetchImpl(`${origin}/api/flow/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({
        conversationId: params.conversationId,
        contactPhone: params.contactPhone,
        organizationId: params.organizationId,
      }),
      signal,
    });

    if (!response.ok) {
      console.error(
        "[flow-engine] flow continuation request failed:",
        response.status,
        await response.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[flow-engine] failed to trigger flow continuation", error);
    return false;
  }
}
