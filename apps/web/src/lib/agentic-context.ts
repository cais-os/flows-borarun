const MAX_AGENTIC_CONTEXT_VARIABLES = 25;
const MAX_SUMMARY_VALUE_LENGTH = 280;

const COACHING_SUMMARY_FIELDS = [
  "objetivo",
  "risco",
  "foco_do_ciclo",
  "agressividade_do_plano",
  "treino_chave_1",
  "treino_chave_2",
  "longao",
  "principais_restricoes",
  "sinais_de_alerta",
  "criterio_para_subir_carga",
  "criterio_para_manter_carga",
  "criterio_para_reduzir_carga",
  "observacoes_importantes_para_o_coach",
] as const;

function truncateSummaryValue(value: string) {
  if (value.length <= MAX_SUMMARY_VALUE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_SUMMARY_VALUE_LENGTH - 3).trimEnd()}...`;
}

function normalizeSummaryValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? truncateSummaryValue(trimmed) : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => normalizeSummaryValue(item))
      .filter((item): item is string => Boolean(item));

    return items.length > 0
      ? truncateSummaryValue(items.join("; "))
      : null;
  }

  return null;
}

function humanizeSummaryKey(key: string) {
  return key.replaceAll("_", " ");
}

function buildCoachingSummaryBlock(rawSummary: string | undefined) {
  const trimmed = rawSummary?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const summary = parsed as Record<string, unknown>;
    const lines = COACHING_SUMMARY_FIELDS.flatMap((key) => {
      const value = normalizeSummaryValue(summary[key]);
      return value ? [`- ${humanizeSummaryKey(key)}: ${value}`] : [];
    });

    if (lines.length === 0) {
      return null;
    }

    return ["Resumo tecnico do plano entregue:", ...lines].join("\n");
  } catch {
    return [
      "Resumo tecnico do plano entregue:",
      `- resumo: ${truncateSummaryValue(trimmed)}`,
    ].join("\n");
  }
}

export function buildAgenticFlowVariableContext(
  variables: Record<string, string>
) {
  const publicLines = Object.entries(variables)
    .filter(([key, value]) => {
      if (!value?.trim()) return false;
      if (key.startsWith("__")) return false;
      if (key.startsWith("_")) return false;
      return true;
    })
    .slice(0, MAX_AGENTIC_CONTEXT_VARIABLES)
    .map(([key, value]) => `- ${key}: ${value}`);

  const sections = [
    publicLines.length > 0
      ? publicLines.join("\n")
      : "Nenhuma variavel publica relevante do flow foi encontrada.",
  ];

  const coachingSummaryBlock = buildCoachingSummaryBlock(
    variables._coaching_summary
  );
  if (coachingSummaryBlock) {
    sections.push(coachingSummaryBlock);
  }

  return sections.join("\n\n");
}
