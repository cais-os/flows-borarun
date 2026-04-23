export type PdfTemplateTheme = {
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  fontFamily: string;
  pagePadding: number;
  radius: number;
};

export type PdfTemplatePreset = {
  id: string;
  name: string;
  description: string;
  html: string;
};

export const PDF_FONT_OPTIONS = [
  {
    label: "Treino Sans",
    value: "'Trebuchet MS', 'Segoe UI', sans-serif",
  },
  {
    label: "Editorial Serif",
    value: "Georgia, 'Times New Roman', serif",
  },
  {
    label: "Relatorio Clean",
    value: "Verdana, Geneva, sans-serif",
  },
] as const;

export const DEFAULT_PDF_TEMPLATE_THEME: PdfTemplateTheme = {
  accentColor: "#d45b2c",
  surfaceColor: "#f6efe7",
  textColor: "#1f2937",
  mutedColor: "#667085",
  fontFamily: PDF_FONT_OPTIONS[0].value,
  pagePadding: 36,
  radius: 20,
};

export const PDF_TEMPLATE_SAMPLE_FLOW_VARIABLES: Record<string, string> = {
  nome: "Marina Costa",
  objetivo: "Correr 10 km abaixo de 55 min",
  frequencia: "4 treinos por semana",
  ritmo_atual: "6:05/km",
  prova_alvo: "10K Floripa",
  distancia_alvo: "10 km",
};

export const PDF_TEMPLATE_SAMPLE_AI_DATA: Record<string, unknown> = {
  titulo: "Plano Bora Run - 8 semanas",
  subtitulo: "Estrutura progressiva para ganhar consistencia e melhorar o pace.",
  aluno: {
    nome: "Marina Costa",
    resumo:
      "Corredora intermediaria, boa aderencia e objetivo claro de baixar o tempo nos 10 km.",
    objetivo: "Reduzir o pace medio e correr a prova com controle.",
    prova_alvo: "10K Floripa - 18 de maio",
    frequencia: "4 treinos por semana",
    ritmo_atual: "6:05/km",
  },
  semanas: [
    {
      numero: 1,
      foco: "Base aerobica e regularidade",
      dias: [
        {
          dia: "Segunda",
          treino: "Corrida leve + educativos",
          distancia_km: "6.5",
          duracao: "40 min",
          intensidade: "Leve",
        },
        {
          dia: "Quarta",
          treino: "Intervalado 6x400m",
          distancia_km: "7.2",
          duracao: "45 min",
          intensidade: "Moderada",
        },
        {
          dia: "Sexta",
          treino: "Rodagem progressiva",
          distancia_km: "5.3",
          duracao: "35 min",
          intensidade: "Moderada",
        },
        {
          dia: "Domingo",
          treino: "Longao progressivo",
          distancia_km: "12",
          duracao: "60 min",
          intensidade: "Leve a moderada",
        },
      ],
    },
    {
      numero: 2,
      foco: "Volume com controle de esforco",
      dias: [
        {
          dia: "Terca",
          treino: "Rodagem continua",
          distancia_km: "7",
          duracao: "45 min",
          intensidade: "Leve",
        },
        {
          dia: "Quinta",
          treino: "Tempo run em bloco",
          distancia_km: "8.5",
          duracao: "50 min",
          intensidade: "Sustentada",
        },
        {
          dia: "Sabado",
          treino: "Rodagem regenerativa",
          distancia_km: "6",
          duracao: "38 min",
          intensidade: "Leve",
        },
        {
          dia: "Domingo",
          treino: "Longao com final firme",
          distancia_km: "14",
          duracao: "70 min",
          intensidade: "Moderada",
        },
      ],
    },
  ],
  dicas: [
    "Aqueca por 10 minutos antes dos treinos intensos.",
    "Priorize sono e hidratacao nas 24h apos os treinos chave.",
    "Registre a sensacao de esforco para ajustar a carga da semana seguinte.",
  ],
  observacoes:
    "Se houver dor persistente ou fadiga acima do normal, reduza o volume e reavalie a progressao.",
};

/* ------------------------------------------------------------------ */
/*  Color mixing helper — replaces CSS color-mix() for Playwright     */
/* ------------------------------------------------------------------ */

function parseHex(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

/** Mix `hex1` into `hex2` at the given `weight` (0–100). weight=18 → 18% hex1 + 82% hex2 */
function hexMix(hex1: string, hex2: string, weight: number): string {
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const w = weight / 100;
  const r = Math.round(r1 * w + r2 * (1 - w));
  const g = Math.round(g1 * w + g2 * (1 - w));
  const b = Math.round(b1 * w + b2 * (1 - w));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const THEME_STYLE_ID = "pdf-theme-vars";

function buildThemeStyles(theme: PdfTemplateTheme): string {
  const accent = theme.accentColor;
  const surface = theme.surfaceColor;
  const white = "#ffffff";
  const black = "#000000";

  // Pre-computed derived colors (replaces CSS color-mix)
  const border = hexMix(accent, white, 18);
  const accentLight12 = hexMix(accent, white, 12);
  const accentDark60 = hexMix(accent, black, 60);
  const surface48 = hexMix(surface, white, 48);
  const surface60 = hexMix(surface, white, 60);
  const surface35 = hexMix(surface, white, 35);
  const border70 = hexMix(border, white, 70);

  return `
  <style id="${THEME_STYLE_ID}">
    :root {
      --pdf-accent: ${accent};
      --pdf-surface: ${surface};
      --pdf-text: ${theme.textColor};
      --pdf-muted: ${theme.mutedColor};
      --pdf-font: ${theme.fontFamily};
      --pdf-page-padding: ${theme.pagePadding}px;
      --pdf-radius: ${theme.radius}px;
      --pdf-border: ${border};
      --pdf-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #efe8de;
      color: var(--pdf-text);
      font-family: var(--pdf-font);
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .pdf-page {
      padding: var(--pdf-page-padding);
      background:
        radial-gradient(circle at top right, ${accentLight12} 0%, transparent 34%),
        linear-gradient(180deg, #fffdf9 0%, #fff 55%, #fffaf3 100%);
    }

    .hero {
      position: relative;
      overflow: hidden;
      border-radius: calc(var(--pdf-radius) + 4px);
      padding: 28px;
      background: linear-gradient(135deg, var(--pdf-accent) 0%, ${accentDark60} 100%);
      color: white;
      box-shadow: var(--pdf-shadow);
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: auto -48px -48px auto;
      width: 180px;
      height: 180px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      z-index: 0;
    }

    .hero > * {
      position: relative;
      z-index: 1;
    }

    .hero-kicker {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.84;
    }

    .hero h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.08;
    }

    .hero p {
      margin: 10px 0 0;
      max-width: 520px;
      font-size: 14px;
      opacity: 0.92;
    }

    .meta-grid,
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .meta-grid > *,
    .cards-grid > *,
    .tip-list > * {
      min-width: 0;
    }

    .panel,
    .metric,
    .week-card,
    .tip-card {
      border: 1px solid var(--pdf-border);
      border-radius: var(--pdf-radius);
      background: white;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
      overflow: hidden;
    }

    .panel {
      padding: 20px;
      background: linear-gradient(180deg, ${surface48} 0%, white 100%);
    }

    .panel h2,
    .week-card h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
    }

    .section-label {
      margin: 0 0 8px;
      color: var(--pdf-accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .meta-item {
      padding: 16px;
      border-radius: calc(var(--pdf-radius) - 4px);
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.65);
    }

    .meta-item strong,
    .metric strong {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--pdf-muted);
    }

    .meta-item span,
    .metric span {
      font-size: 15px;
      font-weight: 600;
      color: var(--pdf-text);
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .metric {
      padding: 16px;
      background: white;
    }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-top: 20px;
    }

    .week-card {
      overflow: hidden;
    }

    .week-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px 16px;
      background: linear-gradient(180deg, ${surface60} 0%, white 100%);
      border-bottom: 1px solid var(--pdf-border);
    }

    .week-tag {
      margin: 0 0 6px;
      color: var(--pdf-accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .days-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .days-table th,
    .days-table td {
      padding: 12px 14px;
      border-bottom: 1px solid ${border70};
      text-align: left;
      vertical-align: top;
    }

    .days-table th {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--pdf-muted);
      background: rgba(255, 255, 255, 0.84);
    }

    .days-table tbody tr:last-child td {
      border-bottom: none;
    }

    .tip-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tip-card {
      padding: 16px;
      background: linear-gradient(180deg, white 0%, ${surface35} 100%);
    }

    .tip-card strong {
      display: block;
      margin-bottom: 8px;
      color: var(--pdf-accent);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .tip-card span {
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .muted {
      color: var(--pdf-muted);
    }

    .footer-note {
      margin-top: 18px;
      font-size: 12px;
      color: var(--pdf-muted);
      overflow-wrap: break-word;
    }

    .hero p,
    .panel p {
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* Page-break control for print/PDF */
    .hero,
    .panel,
    .metric,
    .week-card,
    .tip-card,
    .meta-item {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .stack > * {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    thead {
      display: table-header-group;
    }

    tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>`;
}

function replaceOrInjectStyleBlock(html: string, styleBlock: string): string {
  const blockPattern = new RegExp(
    `<style id="${THEME_STYLE_ID}">[\\s\\S]*?<\\/style>`,
    "i"
  );

  if (blockPattern.test(html)) {
    return html.replace(blockPattern, styleBlock);
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleBlock}\n</head>`);
  }

  return `${styleBlock}\n${html}`;
}

export function applyPdfThemeToTemplate(
  html: string,
  theme: PdfTemplateTheme
): string {
  return replaceOrInjectStyleBlock(html, buildThemeStyles(theme));
}

export function readPdfThemeFromTemplate(html: string): PdfTemplateTheme {
  const getMatch = (variableName: string): string | undefined => {
    const pattern = new RegExp(`${variableName}:\\s*([^;]+);`, "i");
    return html.match(pattern)?.[1]?.trim();
  };

  const fontFamily = getMatch("--pdf-font");
  const accentColor = getMatch("--pdf-accent");
  const surfaceColor = getMatch("--pdf-surface");
  const textColor = getMatch("--pdf-text");
  const mutedColor = getMatch("--pdf-muted");
  const pagePadding = getMatch("--pdf-page-padding");
  const radius = getMatch("--pdf-radius");

  return {
    accentColor: accentColor || DEFAULT_PDF_TEMPLATE_THEME.accentColor,
    surfaceColor: surfaceColor || DEFAULT_PDF_TEMPLATE_THEME.surfaceColor,
    textColor: textColor || DEFAULT_PDF_TEMPLATE_THEME.textColor,
    mutedColor: mutedColor || DEFAULT_PDF_TEMPLATE_THEME.mutedColor,
    fontFamily: fontFamily || DEFAULT_PDF_TEMPLATE_THEME.fontFamily,
    pagePadding: Number.parseInt(pagePadding || "", 10) || DEFAULT_PDF_TEMPLATE_THEME.pagePadding,
    radius: Number.parseInt(radius || "", 10) || DEFAULT_PDF_TEMPLATE_THEME.radius,
  };
}

function createDocument(markup: string, theme = DEFAULT_PDF_TEMPLATE_THEME): string {
  return applyPdfThemeToTemplate(
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
  <main class="pdf-page">
    ${markup}
  </main>
</body>
</html>`,
    theme
  );
}

function buildPerformancePreset(): string {
  return createDocument(`
    <section class="hero">
      <p class="hero-kicker">Plano personalizado</p>
      <h1>{{ai.titulo}}</h1>
      <p>{{ai.subtitulo}}</p>
    </section>

    <section class="meta-grid">
      <article class="panel">
        <p class="section-label">Perfil da aluna</p>
        <h2>{{nome}}</h2>
        <p class="muted">{{ai.aluno.resumo}}</p>
        <div class="cards-grid">
          <div class="meta-item">
            <strong>Objetivo</strong>
            <span>{{objetivo}}</span>
          </div>
          <div class="meta-item">
            <strong>Ritmo atual</strong>
            <span>{{ritmo_atual}}</span>
          </div>
          <div class="meta-item">
            <strong>Frequencia</strong>
            <span>{{frequencia}}</span>
          </div>
          <div class="meta-item">
            <strong>Prova alvo</strong>
            <span>{{prova_alvo}}</span>
          </div>
        </div>
      </article>

      <article class="panel">
        <p class="section-label">Direcao do plano</p>
        <h2>Resumo tecnico</h2>
        <p>{{ai.aluno.objetivo}}</p>
        <div class="stack">
          <div class="metric">
            <strong>Distancia foco</strong>
            <span>{{distancia_alvo}}</span>
          </div>
          <div class="metric">
            <strong>Observacao chave</strong>
            <span>{{ai.observacoes}}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="stack">
      {{#each ai.semanas}}
        <article class="week-card">
          <div class="week-head">
            <div>
              <p class="week-tag">Semana {{numero}}</p>
              <h3>{{foco}}</h3>
            </div>
            <span class="muted">Carga organizada por sessao</span>
          </div>
          <table class="days-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Treino</th>
                <th>Km</th>
                <th>Duracao</th>
                <th>Intensidade</th>
              </tr>
            </thead>
            <tbody>
              {{#each dias}}
                <tr>
                  <td>{{dia}}</td>
                  <td>{{treino}}</td>
                  <td>{{distancia_km}}</td>
                  <td>{{duracao}}</td>
                  <td>{{intensidade}}</td>
                </tr>
              {{/each}}
            </tbody>
          </table>
        </article>
      {{/each}}
    </section>

    <section class="panel" style="margin-top: 18px;">
      <p class="section-label">Dicas da semana</p>
      <h2>Ajustes para manter consistencia</h2>
      <ul class="tip-list">
        {{#each ai.dicas}}
          <li class="tip-card">
            <strong>Dica {{@index}}</strong>
            <span>{{this}}</span>
          </li>
        {{/each}}
      </ul>
      <p class="footer-note">{{ai.observacoes}}</p>
    </section>
  `);
}

function buildMinimalPreset(theme = DEFAULT_PDF_TEMPLATE_THEME): string {
  const surface75 = hexMix(theme.surfaceColor, "#ffffff", 75);

  return createDocument(`
    <section class="panel" style="padding: 0; overflow: hidden;">
      <div style="padding: 26px 28px 20px; background: linear-gradient(180deg, ${surface75} 0%, white 100%); border-bottom: 1px solid var(--pdf-border);">
        <p class="section-label">Bora Run dossier</p>
        <h1 style="margin: 0; font-size: 34px; line-height: 1.04;">{{ai.titulo}}</h1>
        <p style="margin: 10px 0 0; max-width: 560px;" class="muted">{{ai.subtitulo}}</p>
      </div>

      <div style="padding: 24px 28px;">
        <div style="display: flex; justify-content: space-between; gap: 18px; margin-bottom: 22px;">
          <div>
            <p class="section-label">Aluna</p>
            <h2 style="margin: 0;">{{nome}}</h2>
            <p class="muted" style="margin: 8px 0 0;">{{ai.aluno.resumo}}</p>
          </div>
          <div style="min-width: 220px;">
            <div class="metric" style="margin-bottom: 10px;">
              <strong>Objetivo</strong>
              <span>{{objetivo}}</span>
            </div>
            <div class="metric">
              <strong>Frequencia</strong>
              <span>{{frequencia}}</span>
            </div>
          </div>
        </div>

        <div class="stack" style="margin-top: 0;">
          {{#each ai.semanas}}
            <article>
              <div style="display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 10px;">
                <div>
                  <p class="section-label">Semana {{numero}}</p>
                  <h3 style="margin: 0;">{{foco}}</h3>
                </div>
                <span class="muted">Ritmo atual: {{ritmo_atual}}</span>
              </div>
              <table class="days-table" style="border: 1px solid var(--pdf-border); border-radius: calc(var(--pdf-radius) - 2px); overflow: hidden;">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Treino</th>
                    <th>Km</th>
                    <th>Duracao</th>
                    <th>Intensidade</th>
                  </tr>
                </thead>
                <tbody>
                  {{#each dias}}
                    <tr>
                      <td>{{dia}}</td>
                      <td>{{treino}}</td>
                      <td>{{distancia_km}}</td>
                      <td>{{duracao}}</td>
                      <td>{{intensidade}}</td>
                    </tr>
                  {{/each}}
                </tbody>
              </table>
            </article>
          {{/each}}
        </div>

        <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--pdf-border);">
          <p class="section-label">Notas de acompanhamento</p>
          <p style="margin: 0 0 12px;">{{ai.observacoes}}</p>
          <ul style="margin: 0; padding-left: 18px;">
            {{#each ai.dicas}}
              <li style="margin: 0 0 6px;">{{this}}</li>
            {{/each}}
          </ul>
        </div>
      </div>
    </section>
  `);
}

export const PDF_TEMPLATE_PRESETS: PdfTemplatePreset[] = [
  {
    id: "performance",
    name: "Performance",
    description: "Hero forte, cards e semanas em destaque.",
    html: buildPerformancePreset(),
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Relatorio limpo com leitura direta.",
    html: buildMinimalPreset(),
  },
];

export const DEFAULT_PDF_TEMPLATE_HTML = PDF_TEMPLATE_PRESETS[0].html;
