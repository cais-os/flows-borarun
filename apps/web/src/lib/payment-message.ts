export const PAYMENT_LINK_VARIABLE = "{{payment_link}}";
export const DEFAULT_PAYMENT_CTA_BUTTON_TEXT = "Assinar";

const PAYMENT_LINK_VARIABLE_PATTERN = /\{\{payment_link\}\}/g;

function compactBlankLines(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolvePaymentCtaButtonText(value?: string | null) {
  return value?.trim() || DEFAULT_PAYMENT_CTA_BUTTON_TEXT;
}

function buildDefaultPaymentCtaBodyText(planName?: string | null) {
  const normalizedPlanName = planName?.trim();
  return normalizedPlanName
    ? `Para assinar o plano ${normalizedPlanName}, clique no botao abaixo:`
    : "Para assinar o plano, clique no botao abaixo:";
}

export function buildPaymentCtaBodyText(params: {
  messageText?: string | null;
  planName?: string | null;
  paymentUrl?: string | null;
}) {
  if (params.messageText?.trim()) {
    const withoutPlaceholder = params.messageText.replace(
      PAYMENT_LINK_VARIABLE_PATTERN,
      ""
    );
    const withoutResolvedUrl = params.paymentUrl
      ? withoutPlaceholder.replaceAll(params.paymentUrl, "")
      : withoutPlaceholder;

    return (
      compactBlankLines(withoutResolvedUrl) ||
      buildDefaultPaymentCtaBodyText(params.planName)
    );
  }

  return buildDefaultPaymentCtaBodyText(params.planName);
}
