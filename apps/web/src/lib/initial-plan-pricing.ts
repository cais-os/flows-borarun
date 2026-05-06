function normalizePricingText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isInitialPlanPricingQuestion(userMessage: string) {
  const normalized = normalizePricingText(userMessage);
  if (!normalized) return false;

  return (
    /\b(eh|e|seria|isso e|esse plano e|plano e)\s+pago\b/.test(normalized) ||
    /\b(pago|pagar|cobrado|cobranca|gratis|gratuito|gratuita)\b/.test(
      normalized
    ) ||
    /\b(quanto custa|qual o valor|tem custo|custa quanto|valor do plano)\b/.test(
      normalized
    )
  );
}

export function shouldAnswerInitialPlanPricing(
  userMessage: string,
  variables: Record<string, string>
) {
  if (!isInitialPlanPricingQuestion(userMessage)) return false;

  return !variables._training_plan && !variables._plan_generated_at;
}

export function buildInitialFreePlanPricingResponse() {
  return [
    "O plano inicial e gratuito.",
    "Eu so preciso dessas informacoes para montar algo seguro e personalizado para voce.",
    "Depois que o plano inicial for entregue, existe um plano pago de acompanhamento para ajustes semanais, duvidas e suporte continuo, mas voce so ativa se quiser.",
  ].join(" ");
}
