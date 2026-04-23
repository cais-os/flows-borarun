type TrainingDay = Record<string, unknown>;
type TrainingWeek = Record<string, unknown> & {
  dias?: TrainingDay[];
  volume_total_km?: number | string;
};
type TrainingPlan = Record<string, unknown> & {
  perfil_atleta?: Record<string, unknown>;
  semanas?: TrainingWeek[];
};

type NumericRange = {
  min: number;
  max: number;
};

const NON_RUNNING_KEYWORDS = [
  "forca",
  "mobilidade",
  "descanso",
  "off",
  "treino cruzado",
  "cross",
  "bike",
  "bicicleta",
  "eliptico",
  "academia",
];

const RUNNING_KEYWORDS = [
  "corrida",
  "rodagem",
  "regenerativo",
  "longao",
  "fartlek",
  "tempo",
  "limiar",
  "intervalado",
  "progressivo",
  "strides",
  "subida",
  "trote",
];

const EXPLICIT_NON_RUNNING_PATTERNS = [
  /\bdia sem corrida\b/,
  /\bsem corrida\b/,
  /\bnao correr\b/,
  /\bsem treino de corrida\b/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value: number) {
  const rounded = roundToOneDecimal(value);
  return Number.isInteger(rounded)
    ? String(rounded.toFixed(0))
    : String(rounded.toFixed(1));
}

function formatDistanceKm(value: number) {
  return formatNumber(Math.max(0, value));
}

function formatDurationMinutes(range: NumericRange | null) {
  if (!range) return "";
  const min = Math.round(range.min);
  const max = Math.round(range.max);
  return min === max ? String(min) : `${min}-${max}`;
}

function midpoint(range: NumericRange) {
  return (range.min + range.max) / 2;
}

function parseRangeFromRegex(
  text: string,
  expressions: RegExp[]
): NumericRange | null {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (!match) continue;

    const first = parseNumber(match[1] || "");
    const second = parseNumber(match[2] || match[1] || "");
    if (first === null || second === null) continue;

    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  }

  return null;
}

function parseDistanceRangeKm(text: string) {
  return parseRangeFromRegex(normalizeText(text), [
    /(\d+(?:[.,]\d+)?)\s*(?:a|-|ate)\s*(\d+(?:[.,]\d+)?)\s*km\b/,
    /(\d+(?:[.,]\d+)?)\s*km\b/,
  ]);
}

function parseDurationRangeMinutes(text: string) {
  const normalized = normalizeText(text);

  return (
    parseRangeFromRegex(normalized, [
      /total(?:\s+de)?\s+(\d+(?:[.,]\d+)?)\s*(?:a|-|ate)\s*(\d+(?:[.,]\d+)?)\s*min\b/,
      /total(?:\s+de)?\s+(\d+(?:[.,]\d+)?)\s*min\b/,
      /(\d+(?:[.,]\d+)?)\s*(?:a|-|ate)\s*(\d+(?:[.,]\d+)?)\s*min\b/,
      /(\d+(?:[.,]\d+)?)\s*min\b/,
    ]) || null
  );
}

function paceMinutesFromParts(minutes: string, seconds: string) {
  const min = parseNumber(minutes);
  const sec = parseNumber(seconds);
  if (min === null || sec === null) return null;
  return min + sec / 60;
}

function parsePaceRangeMinutesPerKm(text: string) {
  const normalized = normalizeText(text);
  const rangeMatch = normalized.match(
    /(\d{1,2}):(\d{2})\s*(?:a|-|ate)\s*(\d{1,2}):(\d{2})\s*\/?\s*km/
  );

  if (rangeMatch) {
    const start = paceMinutesFromParts(rangeMatch[1], rangeMatch[2]);
    const end = paceMinutesFromParts(rangeMatch[3], rangeMatch[4]);
    if (start !== null && end !== null) {
      return {
        min: Math.min(start, end),
        max: Math.max(start, end),
      };
    }
  }

  const singleMatch = normalized.match(/(\d{1,2}):(\d{2})\s*\/?\s*km/);
  if (!singleMatch) return null;

  const pace = paceMinutesFromParts(singleMatch[1], singleMatch[2]);
  if (pace === null) return null;

  return { min: pace, max: pace };
}

function getDayText(day: TrainingDay) {
  return normalizeText(
    [
      day.tipo,
      day.descricao,
      day.parte_principal,
      day.notas,
      day.aquecimento,
      day.desaquecimento,
    ]
      .map(asString)
      .filter(Boolean)
      .join(" ")
  );
}

function isRunningDay(day: TrainingDay) {
  const text = getDayText(day);
  const hasExplicitNonRunningInstruction = EXPLICIT_NON_RUNNING_PATTERNS.some(
    (pattern) => pattern.test(text)
  );
  const hasRunningKeyword = RUNNING_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );
  const hasNonRunningKeyword = NON_RUNNING_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  if (hasExplicitNonRunningInstruction) return false;
  if (hasRunningKeyword) return true;
  if (hasNonRunningKeyword) return false;

  return true;
}

function getProfileLevel(plan: TrainingPlan) {
  const level = normalizeText(asString(plan.perfil_atleta?.nivel || ""));
  if (level.includes("avanc")) return "advanced" as const;
  if (level.includes("intermedi")) return "intermediate" as const;
  return "beginner" as const;
}

function getEffortRange(day: TrainingDay) {
  const rpeRange = parseRangeFromRegex(normalizeText(asString(day.rpe)), [
    /(\d+(?:[.,]\d+)?)\s*(?:a|-|ate)\s*(\d+(?:[.,]\d+)?)/,
    /(\d+(?:[.,]\d+)?)/,
  ]);

  if (rpeRange) return rpeRange;

  const text = getDayText(day);
  if (text.includes("regenerativo")) return { min: 2, max: 3 };
  if (text.includes("leve") || text.includes("longao")) return { min: 3, max: 4 };
  if (
    text.includes("limiar") ||
    text.includes("tempo") ||
    text.includes("intervalado") ||
    text.includes("fartlek")
  ) {
    return { min: 6, max: 8 };
  }

  return { min: 4, max: 6 };
}

function getFallbackPaceRange(
  level: "beginner" | "intermediate" | "advanced",
  day: TrainingDay
): NumericRange {
  const text = getDayText(day);
  const effort = midpoint(getEffortRange(day));

  if (level === "advanced") {
    if (text.includes("longao")) return { min: 4.9, max: 5.8 };
    if (effort >= 6.5) return { min: 3.8, max: 4.6 };
    if (effort <= 4) return { min: 4.8, max: 5.7 };
    return { min: 4.3, max: 5.1 };
  }

  if (level === "intermediate") {
    if (text.includes("longao")) return { min: 6.0, max: 7.1 };
    if (effort >= 6.5) return { min: 4.9, max: 5.8 };
    if (effort <= 4) return { min: 6.1, max: 7.2 };
    return { min: 5.5, max: 6.4 };
  }

  if (text.includes("longao")) return { min: 8.1, max: 9.4 };
  if (effort >= 6.5) return { min: 6.5, max: 7.4 };
  if (effort <= 4) return { min: 7.8, max: 9.1 };
  return { min: 7.1, max: 8.3 };
}

function estimateDistanceFromDay(
  day: TrainingDay,
  level: "beginner" | "intermediate" | "advanced"
) {
  const directDistance =
    parseDistanceRangeKm(asString(day.distancia_km)) ||
    parseDistanceRangeKm(asString(day.descricao)) ||
    parseDistanceRangeKm(asString(day.parte_principal)) ||
    parseDistanceRangeKm(asString(day.notas));

  if (directDistance) {
    return {
      distanceKm: midpoint(directDistance),
      explicit: true,
      durationRange:
        parseDurationRangeMinutes(asString(day.duracao_min)) ||
        parseDurationRangeMinutes(asString(day.parte_principal)) ||
        parseDurationRangeMinutes(asString(day.descricao)) ||
        null,
    };
  }

  const durationRange =
    parseDurationRangeMinutes(asString(day.duracao_min)) ||
    parseDurationRangeMinutes(asString(day.parte_principal)) ||
    parseDurationRangeMinutes(asString(day.descricao)) ||
    parseDurationRangeMinutes(asString(day.aquecimento)) ||
    null;

  if (!durationRange) {
    return {
      distanceKm: null,
      explicit: false,
      durationRange: null,
    };
  }

  const paceRange =
    parsePaceRangeMinutesPerKm(asString(day.pace_alvo)) ||
    parsePaceRangeMinutesPerKm(asString(day.parte_principal)) ||
    getFallbackPaceRange(level, day);

  const durationMid = midpoint(durationRange);
  const paceMid = midpoint(paceRange);

  return {
    distanceKm: durationMid / paceMid,
    explicit: false,
    durationRange,
  };
}

function ensureDistanceMention(day: TrainingDay, distanceKm: string, estimated: boolean) {
  const prefix = estimated
    ? `Distancia prevista: cerca de ${distanceKm} km. `
    : `Distancia prevista: ${distanceKm} km. `;
  const distanceSummary = estimated
    ? `cerca de ${distanceKm} km`
    : `${distanceKm} km`;

  day.distancia_resumo = distanceSummary;

  const mainPart = asString(day.parte_principal);
  if (mainPart && !/\bkm\b/i.test(mainPart)) {
    day.parte_principal = `${prefix}${mainPart}`.trim();
    return;
  }

  const description = asString(day.descricao);
  if (description && !/\bkm\b/i.test(description)) {
    day.descricao = `${prefix}${description}`.trim();
    return;
  }

  if (!description && !mainPart) {
    day.descricao = prefix.trim();
  }
}

function applyTemplateAliases(day: TrainingDay) {
  const dayLabel = asString(day.dia) || asString(day.dia_semana);
  if (dayLabel && !asString(day.dia)) {
    day.dia = dayLabel;
  }

  const durationLabel = asString(day.duracao) || asString(day.duracao_min);
  if (durationLabel && !asString(day.duracao)) {
    day.duracao = durationLabel;
  }

  const intensityLabel = asString(day.intensidade) || asString(day.rpe);
  if (intensityLabel && !asString(day.intensidade)) {
    day.intensidade = intensityLabel;
  }

  const distanceLabel = asString(day.distancia_km);
  if (distanceLabel) {
    if (!asString(day.km)) {
      day.km = distanceLabel;
    }

    if (!asString(day.distancia)) {
      day.distancia = `${distanceLabel} km`;
    }
  }

  const workoutLabel =
    asString(day.treino) ||
    asString(day.parte_principal) ||
    asString(day.descricao) ||
    asString(day.tipo);
  if (workoutLabel && !asString(day.treino)) {
    day.treino = workoutLabel;
  }
}

export function normalizeTrainingPlan(
  rawPlanData: Record<string, unknown>
): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(rawPlanData || {})) as TrainingPlan;
  const weeks = Array.isArray(cloned.semanas) ? cloned.semanas : [];
  const level = getProfileLevel(cloned);

  for (const week of weeks) {
    if (!Array.isArray(week.dias)) continue;

    const weekTotal =
      typeof week.volume_total_km === "number"
        ? week.volume_total_km
        : parseNumber(asString(week.volume_total_km) || "");

    const estimates = week.dias.map((day) => {
      if (!isRecord(day) || !isRunningDay(day)) {
        return {
          day,
          distanceKm: 0,
          explicit: true,
          running: false,
          durationRange: null as NumericRange | null,
        };
      }

      const estimate = estimateDistanceFromDay(day, level);
      return {
        day,
        distanceKm: estimate.distanceKm,
        explicit: estimate.explicit,
        running: true,
        durationRange: estimate.durationRange,
      };
    });

    const explicitTotal = estimates.reduce(
      (sum, item) => sum + (item.explicit ? item.distanceKm || 0 : 0),
      0
    );
    const estimatedItems = estimates.filter(
      (item) => item.running && !item.explicit && item.distanceKm !== null
    );
    const estimatedTotal = estimatedItems.reduce(
      (sum, item) => sum + (item.distanceKm || 0),
      0
    );

    let scaleFactor = 1;
    if (
      typeof weekTotal === "number" &&
      weekTotal > 0 &&
      estimatedItems.length > 0 &&
      estimatedTotal > 0 &&
      weekTotal > explicitTotal
    ) {
      scaleFactor = (weekTotal - explicitTotal) / estimatedTotal;
    }

    for (const item of estimates) {
      if (!isRecord(item.day)) continue;

      if (!item.running) {
        item.day.distancia_km = "0";
        item.day.distancia_km_estimado = false;
        item.day.distancia_resumo = "0 km";
        applyTemplateAliases(item.day);
        continue;
      }

      const normalizedDistance =
        item.distanceKm === null
          ? null
          : item.explicit
            ? item.distanceKm
            : item.distanceKm * scaleFactor;

      if (normalizedDistance !== null) {
        const formattedDistance = formatDistanceKm(normalizedDistance);
        item.day.distancia_km = formattedDistance;
        item.day.distancia_km_estimado = !item.explicit;
        ensureDistanceMention(item.day, formattedDistance, !item.explicit);
      }

      if (!asString(item.day.duracao_min) && item.durationRange) {
        item.day.duracao_min = formatDurationMinutes(item.durationRange);
      }

      applyTemplateAliases(item.day);
    }
  }

  return cloned as Record<string, unknown>;
}
