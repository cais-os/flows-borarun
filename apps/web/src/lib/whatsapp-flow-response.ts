type FlowResponseData = Record<string, unknown>;

function cleanString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function withoutFlowToken(responseData: FlowResponseData) {
  return Object.fromEntries(
    Object.entries(responseData).filter(
      ([key]) => normalizeKey(key) !== "flow_token"
    )
  );
}

export function extractExternalWhatsAppFlowLeadVariables(
  responseData: FlowResponseData
) {
  const variables: Record<string, string> = {};

  for (const [key, value] of Object.entries(responseData)) {
    const normalizedKey = normalizeKey(key);
    const cleanedValue = cleanString(value);
    if (!cleanedValue || normalizedKey === "flow_token") continue;

    if (!variables.lead_email && normalizedKey.includes("email")) {
      variables.lead_email = cleanedValue;
      continue;
    }

    if (
      !variables.lead_name &&
      (normalizedKey.includes("name") || normalizedKey.includes("nome"))
    ) {
      variables.lead_name = cleanedValue;
    }
  }

  if (variables.lead_name || variables.lead_email) {
    variables.__external_whatsapp_flow_response = JSON.stringify(
      withoutFlowToken(responseData)
    );
  }

  return variables;
}

export function shouldIgnoreExternalWhatsAppFlowReply(params: {
  hasFlowResponseData: boolean;
  currentNodeType: string;
  isNewContact?: boolean;
}) {
  return (
    params.hasFlowResponseData &&
    params.currentNodeType !== "whatsappFlow" &&
    params.isNewContact !== true
  );
}
