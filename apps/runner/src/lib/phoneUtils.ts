import { z } from 'zod';

/**
 * Regex para telefone brasileiro:
 * - Aceita: +5511999999999, 5511999999999, 11999999999, (11) 99999-9999
 * - Normaliza para: +5511999999999
 */
export const PHONE_REGEX = /^(?:\+55|55)?(?:\()?([1-9]{2})(?:\))?(?:\s)?(?:9)?([0-9]{4})(?:-)?([0-9]{4})$/;

export const phoneSchema = z.string()
  .min(10, 'Telefone inválido')
  .max(20, 'Telefone muito longo')
  .refine((val) => PHONE_REGEX.test(val), {
    message: 'Telefone inválido. Use formato: (11) 99999-9999',
  });

/**
 * Normaliza telefone para formato E.164 (+5511999999999)
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  // Adiciona 9 se for celular de 8 dígitos (SP)
  let normalized = cleaned;
  if (cleaned.length === 10 && !cleaned.startsWith('55')) {
    const ddd = cleaned.substring(0, 2);
    const number = cleaned.substring(2);
    normalized = `${ddd}9${number}`;
  }
  
  // Adiciona código do país se não tiver
  if (!normalized.startsWith('55')) {
    normalized = '55' + normalized;
  }
  
  return '+' + normalized;
}

/**
 * Formata para display: +5511999999999 → (11) 99999-9999
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const withoutCountry = cleaned.replace(/^55/, '');
  
  if (withoutCountry.length === 11) {
    const ddd = withoutCountry.substring(0, 2);
    const part1 = withoutCountry.substring(2, 7);
    const part2 = withoutCountry.substring(7, 11);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  return phone;
}
