export function extractFirstScreenIdFromWhatsAppFlowJson(flowJson: unknown) {
  if (!flowJson || typeof flowJson !== "object") return null;

  const screens = (flowJson as { screens?: unknown }).screens;
  if (!Array.isArray(screens)) return null;

  const firstScreen = screens[0];
  if (!firstScreen || typeof firstScreen !== "object") return null;

  const id = (firstScreen as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function resolveWhatsAppFlowInitialScreenId(params: {
  source?: "external" | "builder";
  firstScreenId?: string;
  builderScreenId?: string;
  flowId?: string;
  fetchExternalFirstScreenId?: (flowId: string) => Promise<string | null>;
}) {
  const configuredScreenId = params.firstScreenId?.trim();
  if (configuredScreenId) return configuredScreenId;

  const builderScreenId = params.builderScreenId?.trim();
  if (builderScreenId) return builderScreenId;

  if (
    params.source === "external" &&
    params.flowId?.trim() &&
    params.fetchExternalFirstScreenId
  ) {
    const externalScreenId = await params.fetchExternalFirstScreenId(
      params.flowId.trim()
    );
    if (externalScreenId?.trim()) return externalScreenId.trim();
  }

  return "WELCOME_SCREEN";
}
