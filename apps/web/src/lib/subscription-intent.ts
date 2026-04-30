export function normalizeSubscriptionIntentText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isSubscriptionStatusQuestion(userMessage: string) {
  const normalized = normalizeSubscriptionIntentText(userMessage);
  const hasSubscriptionKeyword =
    /\b(assinatura|assinante|premium|trial|teste|plano)\b/.test(normalized);
  const hasPaymentKeyword =
    /\b(pagamento|paguei|pago|mercado pago|pix|cartao|cobranca)\b/.test(
      normalized
    );
  const hasVerificationIntent =
    /\b(verifica|verificar|verificou|confirm|confirmar|confirmou|confirmado|caiu|aprovad|ativo|ativa|liberad|acesso|status|recebi|consta|entrou|processando|processamento|sou|estou|esta|ta)\b/.test(
      normalized
    );
  const hasExplicitPaidStatement =
    /\b(ja\s+)?paguei\b/.test(normalized) ||
    /\b(efetuei|realizei|fiz)\s+(o\s+)?(pagamento|pix)\b/.test(normalized);

  return (
    hasExplicitPaidStatement ||
    (hasVerificationIntent && (hasPaymentKeyword || hasSubscriptionKeyword))
  );
}
