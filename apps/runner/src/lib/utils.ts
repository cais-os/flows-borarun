import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function metersToKm(meters: number | null | undefined): number {
  if (meters === null || meters === undefined) return 0;
  return meters / 1000;
}

export function secondsToMinutes(seconds: number | null | undefined): number {
  if (seconds === null || seconds === undefined) return 0;
  return seconds / 60;
}

export function secondsToTimeString(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '';

  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function paceSecondsToFormatted(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm === null || secondsPerKm === undefined || !isFinite(secondsPerKm)) return '';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

export function timeStringToSeconds(time: string | null | undefined): number {
  if (!time) return 0;
  const clean = time.trim().toLowerCase().replace(/[^0-9:]/g, '');
  if (!clean) return 0;

  if (!clean.includes(':')) {
    return Number(clean) * 60;
  }

  const parts = clean.split(':').map(Number);
  if (parts.some((p) => Number.isNaN(p))) return 0;

  if (parts.length === 2) {
    const [mm, ss] = parts;
    return mm * 60 + ss;
  }

  const [hh, mm, ss] = parts;
  return hh * 3600 + mm * 60 + ss;
}

export function paceFormattedToSeconds(pace: string | null | undefined): number {
  if (!pace) return 0;
  const normalized = pace.replace('/km', '').trim();
  return timeStringToSeconds(normalized);
}

/**
 * Detecta se o usuário está usando Safari no desktop
 * Safari desktop tem problemas conhecidos com popups do Stripe
 */
export function isSafariDesktop(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

  return isSafari && !isMobile;
}

/**
 * Formata um tempo removendo segundos e exibindo formato compacto
 * Exemplos:
 * - "00:45:00" → "45min"
 * - "01:20:30" → "1h20"
 * - "02:00:00" → "2h"
 * - "16:22" → "16:22" (formato MM:SS)
 * - "16,22" → "16:22" (formato MM,SS convertido)
 * - "16.366" → "16:22" (minutos decimais convertidos para MM:SS)
 * - "45min" → "45min" (já está no formato correto)
 * - "21h" → "21 min" (interpreta como minutos)
 */
export function formatTimeWithoutSeconds(time: string | null | undefined): string {
  if (!time) return '';

  // Se já está no formato com "min", retorna como está
  if (time.includes('min')) {
    return time;
  }

  // Se está no formato "Xh" ou "XXh" sem minutos (provavelmente são minutos incorretamente marcados como horas)
  const hourOnlyMatch = time.match(/^(\d+)h$/);
  if (hourOnlyMatch) {
    const value = parseInt(hourOnlyMatch[1], 10);
    // Se o valor é razoável para ser minutos (< 180 min = 3h), converte para minutos
    if (value <= 180) {
      return `${value} min`;
    }
  }

  // Se tem "h" e números mas não tem ":", assume formato compacto (ex: "1h20")
  if (time.includes('h') && !time.includes(':')) {
    return time;
  }

  // Se contém vírgula, pode ser formato MM,SS ou número decimal
  if (time.includes(',')) {
    // Se tem formato MM,SS (tem dois números separados por vírgula)
    const commaParts = time.split(',');
    if (commaParts.length === 2 && /^\d+$/.test(commaParts[0]) && /^\d+$/.test(commaParts[1])) {
      const minutes = parseInt(commaParts[0], 10);
      const secondsStr = commaParts[1];
      // Interpretar segundos: 1 dígito = dezena, 2+ dígitos = segundos exatos
      const secondsDigits = secondsStr.replace(/[^0-9]/g, '');
      let seconds: number;
      if (secondsDigits.length === 1) {
        seconds = parseInt(secondsDigits, 10) * 10;
      } else if (secondsDigits.length >= 2) {
        seconds = parseInt(secondsDigits.substring(0, 2), 10);
      } else {
        seconds = 0;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    // Se é número decimal com vírgula, converter para ponto e processar
    const decimalValue = parseFloat(time.replace(',', '.'));
    if (!isNaN(decimalValue)) {
      const minutes = Math.floor(decimalValue);
      const seconds = Math.round((decimalValue - minutes) * 60);
      if (seconds === 0) {
        return `${minutes} min`;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Se é número decimal (com ponto), converter para MM:SS
  const decimalMatch = time.match(/^\d+\.\d+$/);
  if (decimalMatch) {
    const decimalValue = parseFloat(time);
    if (!isNaN(decimalValue)) {
      const minutes = Math.floor(decimalValue);
      const seconds = Math.round((decimalValue - minutes) * 60);
      if (seconds === 0) {
        return `${minutes} min`;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Parse do formato HH:MM:SS ou MM:SS
  const parts = time.split(':');
  if (parts.length === 2) {
    // Formato MM:SS
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  } else if (parts.length === 3) {
    // Formato HH:MM:SS
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    // Formato compacto
    if (hours === 0) {
      return `${minutes} min`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h${minutes}`;
    }
  }

  return time;
}

/**
 * Traduz dias da semana do inglês para português (abreviado)
 * Exemplos:
 * - "monday" → "SEG"
 * - "tuesday" → "TER"
 * - "wednesday" → "QUA"
 */
export function translateWeekday(englishDay: string): string {
  const weekdayMap: Record<string, string> = {
    'monday': 'SEG',
    'tuesday': 'TER',
    'wednesday': 'QUA',
    'thursday': 'QUI',
    'friday': 'SEX',
    'saturday': 'SÁB',
    'sunday': 'DOM',
    'mon': 'SEG',
    'tue': 'TER',
    'wed': 'QUA',
    'thu': 'QUI',
    'fri': 'SEX',
    'sat': 'SÁB',
    'sun': 'DOM',
  };

  const normalized = englishDay.toLowerCase().trim();
  return weekdayMap[normalized] || englishDay.substring(0, 3).toUpperCase();
}

/**
 * Abrevia os dias da semana em português
 * Exemplos:
 * - "segunda-feira" → "segunda"
 * - "terça-feira" → "terça"
 * - "quarta-feira" → "quarta"
 * - "quinta-feira" → "quinta"
 * - "sexta-feira" → "sexta"
 * - "sábado" → "sáb"
 * - "domingo" → "dom"
 */
export function abbreviateWeekday(fullDay: string): string {
  const abbreviations: Record<string, string> = {
    'domingo': 'dom',
    'segunda-feira': 'segunda',
    'terça-feira': 'terça',
    'quarta-feira': 'quarta',
    'quinta-feira': 'quinta',
    'sexta-feira': 'sexta',
    'sábado': 'sáb',
  };

  const lowerDay = fullDay.toLowerCase();
  return abbreviations[lowerDay] || fullDay;
}
