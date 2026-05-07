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

export function isSubscriptionPurchaseIntent(userMessage: string) {
  const normalized = normalizeSubscriptionIntentText(userMessage)
    .replace(/[“”"']/g, "")
    .trim();

  if (!normalized) return false;

  const hasExplicitSubscribeIntent =
    /\b(assinar|contratar|comprar|aderir|ativar|liberar)\b/.test(
      normalized
    ) &&
    /\b(premium|plano|assinatura|assinar|contratar|comprar|aderir|ativar|liberar)\b/.test(
      normalized
    );

  const hasPriceQuestion =
    /\b(qual|quanto|quanto\s+e|me\s+fala|manda|passa)\b.*\b(valor|preco|custa|mensalidade)\b/.test(
      normalized
    ) ||
    /\b(quanto\s+custa|qual\s+valor|valor\s+do\s+plano|preco\s+do\s+plano)\b/.test(
      normalized
    );

  const hasPaymentMethodIntent =
    /\b(quero|vou|como|posso|manda|envia|libera)\b.*\b(pagar|pagamento|pix|cartao|boleto|link)\b/.test(
      normalized
    ) ||
    /\b(link\s+de\s+pagamento|pagar\s+no\s+pix|pagar\s+com\s+cartao)\b/.test(
      normalized
    );

  return hasExplicitSubscribeIntent || hasPriceQuestion || hasPaymentMethodIntent;
}
