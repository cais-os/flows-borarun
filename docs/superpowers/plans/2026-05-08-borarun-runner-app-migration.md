# BoraRun Runner App Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the BoraRun runner app into `apps/runner`, expose a public no-login `/plano/:phone` experience, and add a `Web App` flow node in `apps/web` that sends the personalized runner link and can trigger AI plan generation.

**Architecture:** Keep `apps/web` as the Next.js flow builder and server-side integration layer. Add `apps/runner` as a Vite/React app copied from `cais-os/borarun`, with public route adapters that call `apps/web` APIs. Persist public runner plans through Supabase bridge tables and keep `conversations.flow_variables` synchronized for the existing coach and sales flows.

**Tech Stack:** Next.js 16 App Router, Vite React, React Router, Supabase, OpenAI, WhatsApp Cloud API, node:test, TypeScript.

---

## File Structure

- Create `apps/runner/**`: migrated BoraRun Vite app copied from `cais-os/borarun/apps/app`.
- Modify `apps/runner/package.json`: rename the package and keep runner-specific scripts.
- Modify `apps/runner/.env.template`: add API base URL for the flow builder backend.
- Create `apps/runner/src/pages/PublicPlan.tsx`: no-login public plan route.
- Create `apps/runner/src/lib/publicPlanApi.ts`: client for `apps/web` public runner APIs.
- Modify `apps/runner/src/App.tsx`: add `/plano/:phone` outside auth/subscription wrappers.
- Create one Supabase migration under `supabase/migrations/*_runner_public_plan_bridge.sql`: public runner bridge schema.
- Create `apps/web/src/lib/training-plan-generator.ts`: shared AI JSON plan generator extracted from the PDF generator.
- Modify `apps/web/src/lib/pdf-generator.ts`: use the shared AI plan generator before rendering PDF HTML.
- Create `apps/web/src/lib/training-plan-generator.test.mjs`: parser and prompt tests.
- Create `apps/web/src/lib/runner/phone.ts`: phone normalization.
- Create `apps/web/src/lib/runner/url.ts`: runner link builder.
- Create `apps/web/src/lib/runner/plan-mapper.ts`: map normalized AI plan JSON to runner relational rows.
- Create `apps/web/src/lib/runner/plan-store.ts`: Supabase persistence and fetch helpers.
- Create `apps/web/src/lib/runner/plan-store.test.mjs`: unit tests for phone, URL, and mapping behavior.
- Create `apps/web/src/app/api/runner/plans/[phone]/route.ts`: public GET/POST/OPTIONS API for runner plan loading and generation.
- Modify `apps/web/.env.example`: document runner app environment variables.
- Modify `apps/web/src/types/flow.ts`: add `WEB_APP` node type.
- Modify `apps/web/src/types/node-data.ts`: add `WebAppNodeData`.
- Modify `apps/web/src/lib/constants.ts`: add node palette metadata.
- Create `apps/web/src/components/nodes/web-app-node.tsx`: visual flow node.
- Create `apps/web/src/components/editors/web-app-editor.tsx`: node editor form.
- Modify `apps/web/src/components/canvas/flow-canvas.tsx`: register node and defaults.
- Modify `apps/web/src/components/layout/flow-sidebar.tsx`: add palette button.
- Modify `apps/web/src/components/editors/node-editor-panel.tsx`: add editor switch.
- Modify `apps/web/src/lib/flow-engine.ts`: execute the `webApp` node.

---

## Task 1: Import The Runner App

**Files:**
- Create: `apps/runner/**`
- Modify: `apps/runner/package.json`
- Modify: `apps/runner/.env.template`
- Create: `apps/runner/README.md`

- [ ] **Step 1: Prepare a fresh source checkout**

Run from repo root:

```powershell
$sourceRoot = Join-Path $env:TEMP "borarun-source-runner-migration"
if (Test-Path $sourceRoot) {
  git -C $sourceRoot fetch --depth 1 origin main
  git -C $sourceRoot reset --hard origin/main
} else {
  git clone --depth 1 https://github.com/cais-os/borarun.git $sourceRoot
}
```

Expected: `$sourceRoot\apps\app\package.json` exists.

- [ ] **Step 2: Copy the BoraRun app into `apps/runner`**

Run from repo root:

```powershell
$sourceApp = Join-Path $env:TEMP "borarun-source-runner-migration\apps\app"
$destApp = "C:\Users\rodri\Desktop\Flows BoraRun\apps\runner"
New-Item -ItemType Directory -Force -Path $destApp | Out-Null
robocopy $sourceApp $destApp /E /XD node_modules dist .git /XF bun.lockb
if ($LASTEXITCODE -le 7) { exit 0 } else { exit $LASTEXITCODE }
```

Expected: `apps/runner/src/App.tsx`, `apps/runner/vite.config.ts`, and `apps/runner/package.json` exist.

- [ ] **Step 3: Rename the runner package**

Modify `apps/runner/package.json`:

```json
{
  "name": "borarun-runner",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview --host 0.0.0.0"
  }
}
```

Keep the existing `dependencies` and `devDependencies` sections from the copied file unchanged.

- [ ] **Step 4: Add runner API environment documentation**

Modify `apps/runner/.env.template` so it contains these lines:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_FLOW_API_BASE_URL=http://localhost:3000
```

If the copied file already contains Supabase variables, keep their values blank and add `VITE_FLOW_API_BASE_URL`.

- [ ] **Step 5: Add a runner migration README**

Create `apps/runner/README.md`:

```markdown
# BoraRun Runner App

This app is migrated from `cais-os/borarun/apps/app`.

The production-critical route for this repository is `/plano/:phone`, which opens a no-login runner plan experience from WhatsApp.

Auth, subscription checkout, subscription gating, and premium rules are owned by `apps/web` and the flow system. Code copied from the original app that supports auth or subscription screens is migration carry-over only and can be removed after the public runner route is stable.

Local development:

```bash
npm install
npm run dev
```

Use `VITE_FLOW_API_BASE_URL` to point this app at the flow builder backend that serves public runner plan APIs.
```

- [ ] **Step 6: Install and build the copied app**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\runner"
npm install
npm run build
```

Expected: `npm run build` completes and creates `apps/runner/dist`.

- [ ] **Step 7: Commit the import**

Run from repo root:

```powershell
git add apps/runner
git commit -m "feat: add borarun runner app"
```

---

## Task 2: Add Public Runner Plan Schema

**Files:**
- Create: `supabase/migrations/*_runner_public_plan_bridge.sql`

- [ ] **Step 1: Create the migration through Supabase CLI**

Run from repo root:

```powershell
$before = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Select-Object -ExpandProperty FullName
supabase migration new runner_public_plan_bridge
$after = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Select-Object -ExpandProperty FullName
$migration = Compare-Object $before $after -PassThru | Select-Object -First 1
Write-Output $migration
```

Expected: command prints the new migration path ending in `_runner_public_plan_bridge.sql`.

- [ ] **Step 2: Fill the migration**

Write this SQL into the migration file printed in Step 1:

```sql
create extension if not exists pgcrypto;

do $$
begin
  create type public.runner_generation_status as enum ('idle', 'generating', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.runner_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  phone text not null,
  normalized_phone text not null unique,
  public_access_key text not null default encode(gen_random_bytes(16), 'hex'),
  generation_status public.runner_generation_status not null default 'idle',
  generated_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists runner_profiles_conversation_id_idx
  on public.runner_profiles(conversation_id);

create index if not exists runner_profiles_organization_id_idx
  on public.runner_profiles(organization_id);

drop trigger if exists trg_runner_profiles_set_updated_at on public.runner_profiles;
create trigger trg_runner_profiles_set_updated_at
before update on public.runner_profiles
for each row
execute function public.set_updated_at_timestamp();

alter table public.runner_profiles enable row level security;

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  runner_profile_id uuid references public.runner_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  goal_type text not null,
  goal_distance numeric,
  race_date date,
  start_date date,
  total_weeks integer not null,
  total_distance numeric not null default 0,
  completed_distance numeric not null default 0,
  completed_weeks integer not null default 0,
  raw_plan jsonb not null default '{}'::jsonb,
  coaching_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint training_plans_owner_check check (
    runner_profile_id is not null or user_id is not null
  )
);

create unique index if not exists training_plans_runner_profile_id_unique_idx
  on public.training_plans(runner_profile_id)
  where runner_profile_id is not null;

create index if not exists training_plans_conversation_id_idx
  on public.training_plans(conversation_id);

drop trigger if exists trg_training_plans_set_updated_at on public.training_plans;
create trigger trg_training_plans_set_updated_at
before update on public.training_plans
for each row
execute function public.set_updated_at_timestamp();

alter table public.training_plans enable row level security;

create table if not exists public.weekly_trainings (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.training_plans(id) on delete cascade,
  runner_profile_id uuid references public.runner_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  week_number integer not null,
  day_of_week text not null,
  date date not null,
  type text not null,
  name text not null,
  title text not null,
  description text,
  distance numeric not null default 0,
  pace text not null default '',
  duration numeric not null default 0,
  elapsed_time numeric not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  actual_distance numeric,
  actual_elapsed_time numeric,
  actual_time text,
  actual_pace text,
  difficulty_level integer check (difficulty_level between 1 and 5),
  feedbacks text,
  source text not null default 'plan',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists weekly_trainings_plan_week_idx
  on public.weekly_trainings(training_plan_id, week_number);

create index if not exists weekly_trainings_runner_profile_date_idx
  on public.weekly_trainings(runner_profile_id, date);

alter table public.weekly_trainings enable row level security;
```

- [ ] **Step 3: Verify migration syntax locally**

Run:

```powershell
supabase db reset
```

Expected: local database resets and applies all migrations without SQL errors.

- [ ] **Step 4: Commit schema**

Run:

```powershell
git add supabase/migrations
git commit -m "feat: add runner public plan schema"
```

---

## Task 3: Extract Shared AI Training Plan Generation

**Files:**
- Create: `apps/web/src/lib/training-plan-generator.ts`
- Modify: `apps/web/src/lib/pdf-generator.ts`
- Create: `apps/web/src/lib/training-plan-generator.test.mjs`

- [ ] **Step 1: Write parser tests**

Create `apps/web/src/lib/training-plan-generator.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTypeScriptModule(relativePath, requireOverrides = {}) {
  const filename = path.join(import.meta.dirname, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const cjsModule = { exports: {} };
  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  });
  return cjsModule.exports;
}

const {
  buildTrainingPlanUserContent,
  parseTrainingPlanCompletion,
} = loadTypeScriptModule("./training-plan-generator.ts");

test("parses structured training plan payload", () => {
  const payload = parseTrainingPlanCompletion(JSON.stringify({
    training_plan: { perfil_atleta: { nivel: "iniciante" }, semanas: [] },
    coaching_summary: { foco: "consistencia" },
  }));

  assert.deepEqual(payload.rawPlanData, {
    perfil_atleta: { nivel: "iniciante" },
    semanas: [],
  });
  assert.deepEqual(payload.coachingSummary, { foco: "consistencia" });
});

test("falls back to root object when training_plan key is absent", () => {
  const payload = parseTrainingPlanCompletion(JSON.stringify({
    perfil_atleta: { nivel: "intermediario" },
    semanas: [{ semana: 1 }],
  }));

  assert.deepEqual(payload.rawPlanData, {
    perfil_atleta: { nivel: "intermediario" },
    semanas: [{ semana: 1 }],
  });
  assert.deepEqual(payload.coachingSummary, {});
});

test("builds user content with Strava context when present", () => {
  const content = buildTrainingPlanUserContent({
    flowVariables: { nome: "Ana", objetivo: "5 km" },
    stravaContext: "Volume recente: 12 km",
  });

  assert.match(content, /Informacoes do aluno:/);
  assert.match(content, /nome: Ana/);
  assert.match(content, /objetivo: 5 km/);
  assert.match(content, /Dados do Strava:/);
  assert.match(content, /Volume recente: 12 km/);
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
node --test src/lib/training-plan-generator.test.mjs
```

Expected: FAIL because `training-plan-generator.ts` does not exist.

- [ ] **Step 3: Create the shared generator**

Create `apps/web/src/lib/training-plan-generator.ts`:

```ts
import OpenAI from "openai";
import { PLANEJADOR_INICIAL_PROMPT } from "@/lib/prompts/planejador-inicial";
import { normalizeTrainingPlan } from "@/lib/training-plan";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION =
  "Voce e um treinador de corrida especialista. Com base nas informacoes do aluno abaixo, gere um plano de treino personalizado.";

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON valido (sem markdown, sem codigo, sem explicacoes) com EXATAMENTE 2 chaves raiz:
1. "training_plan" - com as sub-chaves: perfil_atleta, logica_plano, semanas
2. "coaching_summary" - com o resumo interno para o coach de acompanhamento`;

export type TrainingPlanGenerationResult = {
  planData: Record<string, unknown>;
  coachingSummary: Record<string, unknown>;
};

export function buildTrainingPlanUserContent(params: {
  flowVariables: Record<string, string>;
  stravaContext?: string;
}) {
  const variablesSummary = Object.entries(params.flowVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  if (params.stravaContext) {
    return `Informacoes do aluno:\n${variablesSummary}\n\nDados do Strava:\n${params.stravaContext}`;
  }

  return `Informacoes do aluno:\n${variablesSummary}`;
}

export function parseTrainingPlanCompletion(aiResponse: string): {
  rawPlanData: Record<string, unknown>;
  coachingSummary: Record<string, unknown>;
} {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(aiResponse);
  } catch {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch {
      console.error("Failed to parse AI response as JSON:", aiResponse);
      parsed = { error: "Falha ao gerar plano", raw: aiResponse };
    }
  }

  return {
    rawPlanData: (parsed.training_plan as Record<string, unknown>) || parsed,
    coachingSummary:
      (parsed.coaching_summary as Record<string, unknown>) || {},
  };
}

export async function generateTrainingPlanData(params: {
  flowVariables: Record<string, string>;
  aiPrompt?: string;
  adjustmentRequest?: string;
  stravaContext?: string;
}): Promise<TrainingPlanGenerationResult> {
  const usePlanejadorPrompt = !params.aiPrompt;
  const baseInstruction = usePlanejadorPrompt
    ? PLANEJADOR_INICIAL_PROMPT + JSON_FORMAT_INSTRUCTION
    : (params.aiPrompt || DEFAULT_INSTRUCTION) + JSON_FORMAT_INSTRUCTION;

  const adjustmentInstruction = params.adjustmentRequest?.trim()
    ? `\n\nAJUSTE SOLICITADO PELO USUARIO:\n${params.adjustmentRequest.trim()}\n\nGere uma nova versao do plano incorporando esse pedido de forma coerente, segura e personalizada. Preserve o restante do contexto sempre que fizer sentido e mantenha o foco em treinos de corrida.`
    : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      {
        role: "system",
        content: `${baseInstruction}${adjustmentInstruction}`,
      },
      {
        role: "user",
        content: buildTrainingPlanUserContent({
          flowVariables: params.flowVariables,
          stravaContext: params.stravaContext,
        }),
      },
    ],
    response_format: { type: "json_object" },
  });

  const aiResponse = completion.choices[0]?.message?.content || "{}";
  const { rawPlanData, coachingSummary } =
    parseTrainingPlanCompletion(aiResponse);

  return {
    planData: normalizeTrainingPlan(rawPlanData, {
      flowVariables: params.flowVariables,
    }),
    coachingSummary,
  };
}
```

- [ ] **Step 4: Refactor the PDF generator**

Modify `apps/web/src/lib/pdf-generator.ts`:

Remove:

```ts
import OpenAI from "openai";
import { PLANEJADOR_INICIAL_PROMPT } from "@/lib/prompts/planejador-inicial";
import { normalizeTrainingPlan } from "@/lib/training-plan";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_INSTRUCTION = `Você é um treinador de corrida especialista. Com base nas informações do aluno abaixo, gere um plano de treino personalizado.`;

const JSON_FORMAT_INSTRUCTION = `

IMPORTANTE: Retorne APENAS um JSON válido (sem markdown, sem código, sem explicações) com EXATAMENTE 2 chaves raiz:
1. "training_plan" — com as sub-chaves: perfil_atleta, logica_plano, semanas
2. "coaching_summary" — com o resumo interno para o coach de acompanhamento`;
```

Add:

```ts
import { generateTrainingPlanData } from "@/lib/training-plan-generator";
```

Replace the AI completion, parsing, and `normalizeTrainingPlan` block inside `generatePdf` with:

```ts
  const { planData, coachingSummary } = await generateTrainingPlanData({
    flowVariables: params.flowVariables,
    aiPrompt: params.aiPrompt,
    adjustmentRequest: params.adjustmentRequest,
    stravaContext: params.stravaContext,
  });
```

Keep the HTML interpolation and PDF rendering blocks unchanged.

- [ ] **Step 5: Run generator tests**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
node --test src/lib/training-plan-generator.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run web build**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
npm run build
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 7: Commit shared generator**

Run:

```powershell
git add apps/web/src/lib/training-plan-generator.ts apps/web/src/lib/training-plan-generator.test.mjs apps/web/src/lib/pdf-generator.ts
git commit -m "feat: share training plan generator"
```

---

## Task 4: Add Runner Plan Server Helpers

**Files:**
- Create: `apps/web/src/lib/runner/phone.ts`
- Create: `apps/web/src/lib/runner/url.ts`
- Create: `apps/web/src/lib/runner/plan-mapper.ts`
- Create: `apps/web/src/lib/runner/plan-store.ts`
- Create: `apps/web/src/lib/runner/plan-store.test.mjs`

- [ ] **Step 1: Write helper tests**

Create `apps/web/src/lib/runner/plan-store.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTypeScriptModule(relativePath) {
  const filename = path.join(import.meta.dirname, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const cjsModule = { exports: {} };
  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require(specifier) {
      if (Object.prototype.hasOwnProperty.call(requireOverrides, specifier)) {
        return requireOverrides[specifier];
      }
      return require(specifier);
    },
  });
  return cjsModule.exports;
}

const { normalizeRunnerPhone } = loadTypeScriptModule("./phone.ts");
const { buildRunnerPlanUrl } = loadTypeScriptModule("./url.ts", {
  "@/lib/runner/phone": { normalizeRunnerPhone },
});
const { mapPlanToRunnerRows } = loadTypeScriptModule("./plan-mapper.ts");

test("normalizes phone to digits", () => {
  assert.equal(normalizeRunnerPhone("+55 (11) 99999-0000"), "5511999990000");
});

test("builds phone-based runner URL", () => {
  assert.equal(
    buildRunnerPlanUrl({
      baseUrl: "https://runner.example.com/",
      phone: "+55 (11) 99999-0000",
    }),
    "https://runner.example.com/plano/5511999990000"
  );
});

test("maps plan weeks and days to runner rows", () => {
  const result = mapPlanToRunnerRows({
    runnerProfileId: "profile-1",
    trainingPlanId: "plan-1",
    startDate: "2026-05-11",
    planData: {
      perfil_atleta: { objetivo: "5 km" },
      semanas: [
        {
          semana: 1,
          volume_total_km: "7",
          dias: [
            {
              dia: "Segunda",
              tipo: "Corrida leve",
              treino: "Rodagem leve",
              descricao: "3 km leve",
              distancia_km: "3",
              duracao_min: "24",
              pace_alvo: "8:00/km",
            },
            {
              dia: "Quarta",
              tipo: "Longao",
              treino: "Longao curto",
              descricao: "4 km confortavel",
              distancia_km: "4",
              duracao_min: "34",
              pace_alvo: "8:30/km",
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.plan.total_weeks, 1);
  assert.equal(result.plan.total_distance, 7);
  assert.equal(result.trainings.length, 2);
  assert.equal(result.trainings[0].date, "2026-05-11");
  assert.equal(result.trainings[1].date, "2026-05-13");
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
node --test src/lib/runner/plan-store.test.mjs
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Create phone and URL helpers**

Create `apps/web/src/lib/runner/phone.ts`:

```ts
export function normalizeRunnerPhone(phone: string) {
  return (phone || "").replace(/\D/g, "");
}
```

Create `apps/web/src/lib/runner/url.ts`:

```ts
import { normalizeRunnerPhone } from "@/lib/runner/phone";

export function getRunnerAppBaseUrl(requestOrigin?: string) {
  return (
    process.env.RUNNER_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_RUNNER_APP_BASE_URL ||
    requestOrigin ||
    ""
  ).replace(/\/+$/, "");
}

export function buildRunnerPlanUrl(params: {
  baseUrl: string;
  phone: string;
}) {
  const normalizedPhone = normalizeRunnerPhone(params.phone);
  const baseUrl = params.baseUrl.replace(/\/+$/, "");
  return `${baseUrl}/plano/${normalizedPhone}`;
}
```

- [ ] **Step 4: Create the plan mapper**

Create `apps/web/src/lib/runner/plan-mapper.ts`:

```ts
type JsonRecord = Record<string, unknown>;

const DAY_OFFSETS: Record<string, number> = {
  segunda: 0,
  "segunda-feira": 0,
  terca: 1,
  "terca-feira": 1,
  terça: 1,
  "terça-feira": 1,
  quarta: 2,
  "quarta-feira": 2,
  quinta: 3,
  "quinta-feira": 3,
  sexta: 4,
  "sexta-feira": 4,
  sabado: 5,
  sábado: 5,
  domingo: 6,
};

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function parseNumber(value: unknown) {
  const parsed = Number(asString(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDay(value: unknown) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(startDate: string, weekIndex: number) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return addDays(start, weekIndex * 7);
}

function inferTrainingType(day: JsonRecord) {
  const text = [
    day.tipo,
    day.treino,
    day.descricao,
    day.parte_principal,
  ]
    .map(asString)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (text.includes("long")) return "long";
  if (text.includes("tiro") || text.includes("interval")) return "interval";
  if (text.includes("regener")) return "recovery";
  return "easy";
}

export function mapPlanToRunnerRows(params: {
  runnerProfileId: string;
  trainingPlanId: string;
  startDate: string;
  planData: JsonRecord;
}) {
  const weeks = Array.isArray(params.planData.semanas)
    ? (params.planData.semanas as JsonRecord[])
    : [];

  const trainings = weeks.flatMap((week, weekIndex) => {
    const weekNumber = Number(week.semana || week.week || weekIndex + 1);
    const days = Array.isArray(week.dias) ? (week.dias as JsonRecord[]) : [];
    const weekStart = getWeekStart(params.startDate, weekIndex);

    return days.map((day, dayIndex) => {
      const dayLabel =
        asString(day.dia) || asString(day.dia_semana) || `Dia ${dayIndex + 1}`;
      const offset = DAY_OFFSETS[normalizeDay(dayLabel)] ?? dayIndex;
      const distance = parseNumber(day.distancia_km || day.km);
      const durationMinutes = parseNumber(day.duracao_min || day.duracao);
      const title =
        asString(day.treino) ||
        asString(day.tipo) ||
        asString(day.parte_principal) ||
        "Treino do plano";

      return {
        training_plan_id: params.trainingPlanId,
        runner_profile_id: params.runnerProfileId,
        week_number: weekNumber,
        day_of_week: dayLabel,
        date: toIsoDate(addDays(weekStart, offset)),
        type: inferTrainingType(day),
        name: title,
        title,
        description:
          asString(day.descricao) ||
          asString(day.parte_principal) ||
          asString(day.notas),
        distance,
        pace: asString(day.pace_alvo),
        duration: durationMinutes,
        elapsed_time: durationMinutes * 60,
        source: "plan",
      };
    });
  });

  const totalDistance = trainings.reduce(
    (sum, training) => sum + Number(training.distance || 0),
    0
  );

  return {
    plan: {
      runner_profile_id: params.runnerProfileId,
      goal_type: asString(
        (params.planData.perfil_atleta as JsonRecord | undefined)?.objetivo
      ) || "corrida",
      goal_distance: 0,
      start_date: params.startDate,
      total_weeks: weeks.length,
      total_distance: totalDistance,
      completed_distance: 0,
      completed_weeks: 0,
      raw_plan: params.planData,
    },
    trainings,
  };
}
```

- [ ] **Step 5: Create the Supabase store**

Create `apps/web/src/lib/runner/plan-store.ts` with service-role-only helpers:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRunnerPhone } from "@/lib/runner/phone";
import { mapPlanToRunnerRows } from "@/lib/runner/plan-mapper";

export async function getRunnerProfileByPhone(
  supabase: SupabaseClient,
  phone: string
) {
  const normalizedPhone = normalizeRunnerPhone(phone);
  const { data, error } = await supabase
    .from("runner_profiles")
    .select("*")
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureRunnerProfile(params: {
  supabase: SupabaseClient;
  phone: string;
  conversationId: string;
  organizationId: string;
}) {
  const normalizedPhone = normalizeRunnerPhone(params.phone);
  const { data, error } = await params.supabase
    .from("runner_profiles")
    .upsert(
      {
        phone: params.phone,
        normalized_phone: normalizedPhone,
        conversation_id: params.conversationId,
        organization_id: params.organizationId,
      },
      { onConflict: "normalized_phone" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPublicRunnerPlan(params: {
  supabase: SupabaseClient;
  phone: string;
}) {
  const profile = await getRunnerProfileByPhone(params.supabase, params.phone);
  if (!profile) return null;

  const { data: plan, error: planError } = await params.supabase
    .from("training_plans")
    .select("*")
    .eq("runner_profile_id", profile.id)
    .maybeSingle();

  if (planError) throw planError;

  const { data: trainings, error: trainingsError } = plan
    ? await params.supabase
        .from("weekly_trainings")
        .select("*")
        .eq("training_plan_id", plan.id)
        .order("week_number", { ascending: true })
        .order("date", { ascending: true })
    : { data: [], error: null };

  if (trainingsError) throw trainingsError;

  return {
    profile,
    plan,
    trainings: trainings || [],
  };
}

export async function persistRunnerPlan(params: {
  supabase: SupabaseClient;
  runnerProfileId: string;
  conversationId: string;
  organizationId: string;
  startDate: string;
  planData: Record<string, unknown>;
  coachingSummary: Record<string, unknown>;
}) {
  const { data: profile, error: profileError } = await params.supabase
    .from("runner_profiles")
    .select("phone")
    .eq("id", params.runnerProfileId)
    .single();

  if (profileError) throw profileError;

  const trainingPlanId = crypto.randomUUID();
  const mapped = mapPlanToRunnerRows({
    runnerProfileId: params.runnerProfileId,
    trainingPlanId,
    startDate: params.startDate,
    planData: params.planData,
  });

  const { data: plan, error: planError } = await params.supabase
    .from("training_plans")
    .upsert(
      {
        id: trainingPlanId,
        ...mapped.plan,
        conversation_id: params.conversationId,
        organization_id: params.organizationId,
        coaching_summary: params.coachingSummary,
      },
      { onConflict: "runner_profile_id" }
    )
    .select()
    .single();

  if (planError) throw planError;

  await params.supabase
    .from("weekly_trainings")
    .delete()
    .eq("training_plan_id", plan.id);

  if (mapped.trainings.length > 0) {
    const { error: trainingsError } = await params.supabase
      .from("weekly_trainings")
      .insert(
        mapped.trainings.map((training) => ({
          ...training,
          training_plan_id: plan.id,
        }))
      );

    if (trainingsError) throw trainingsError;
  }

  await params.supabase
    .from("runner_profiles")
    .update({
      generation_status: "completed",
      generated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", params.runnerProfileId);

  return getPublicRunnerPlan({
    supabase: params.supabase,
    phone: String(profile.phone || ""),
  });
}
```

- [ ] **Step 6: Run helper tests**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
node --test src/lib/runner/plan-store.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit helpers**

Run:

```powershell
git add apps/web/src/lib/runner
git commit -m "feat: add runner plan helpers"
```

---

## Task 5: Add Public Runner Plan APIs

**Files:**
- Create: `apps/web/src/app/api/runner/plans/[phone]/route.ts`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Create API route**

Create `apps/web/src/app/api/runner/plans/[phone]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateTrainingPlanData } from "@/lib/training-plan-generator";
import { buildRunnerPlanUrl, getRunnerAppBaseUrl } from "@/lib/runner/url";
import {
  ensureRunnerProfile,
  getPublicRunnerPlan,
  persistRunnerPlan,
} from "@/lib/runner/plan-store";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      process.env.RUNNER_APP_ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders(),
      ...(init?.headers || {}),
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
  const supabase = createServerClient();
  const publicPlan = await getPublicRunnerPlan({ supabase, phone });
  const baseUrl = getRunnerAppBaseUrl(new URL(request.url).origin);

  if (!publicPlan) {
    return json(
      {
        profile: null,
        plan: null,
        trainings: [],
        webAppLink: buildRunnerPlanUrl({ baseUrl, phone }),
      },
      { status: 404 }
    );
  }

  return json({
    ...publicPlan,
    webAppLink: buildRunnerPlanUrl({
      baseUrl,
      phone: publicPlan.profile.phone || phone,
    }),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
  const supabase = createServerClient();
  const existing = await getPublicRunnerPlan({ supabase, phone });

  if (!existing?.profile) {
    return json(
      { error: "Runner profile not found for this phone" },
      { status: 404 }
    );
  }

  if (existing.plan && existing.trainings.length > 0) {
    return json(existing);
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, organization_id, flow_variables")
    .eq("id", existing.profile.conversation_id)
    .maybeSingle();

  if (conversationError) {
    return json({ error: conversationError.message }, { status: 500 });
  }

  if (!conversation) {
    return json({ error: "Conversation not found" }, { status: 404 });
  }

  await supabase
    .from("runner_profiles")
    .update({ generation_status: "generating", last_error: null })
    .eq("id", existing.profile.id);

  try {
    const body = await request.json().catch(() => ({}));
    const flowVariables =
      (conversation.flow_variables as Record<string, string> | null) || {};

    const { planData, coachingSummary } = await generateTrainingPlanData({
      flowVariables,
      aiPrompt: typeof body.aiPrompt === "string" ? body.aiPrompt : undefined,
    });

    const startDate =
      typeof flowVariables.data_inicio_plano === "string"
        ? flowVariables.data_inicio_plano
        : new Date().toISOString().slice(0, 10);

    const updatedVars = {
      ...flowVariables,
      _training_plan: JSON.stringify(planData),
      _coaching_summary: JSON.stringify(coachingSummary),
      _plan_generated_at: new Date().toISOString(),
    };

    await supabase
      .from("conversations")
      .update({ flow_variables: updatedVars })
      .eq("id", conversation.id);

    const persisted = await persistRunnerPlan({
      supabase,
      runnerProfileId: existing.profile.id,
      conversationId: conversation.id,
      organizationId: conversation.organization_id as string,
      startDate,
      planData,
      coachingSummary,
    });

    return json(persisted);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate plan";
    await supabase
      .from("runner_profiles")
      .update({ generation_status: "failed", last_error: message })
      .eq("id", existing.profile.id);
    return json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Document web env variables**

Modify `apps/web/.env.example`:

```dotenv
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RUNNER_APP_BASE_URL=http://localhost:5173
RUNNER_APP_ALLOWED_ORIGIN=http://localhost:5173
NEXT_PUBLIC_RUNNER_APP_BASE_URL=http://localhost:5173
```

- [ ] **Step 3: Run web build**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit APIs**

Run:

```powershell
git add apps/web/src/app/api/runner apps/web/.env.example
git commit -m "feat: add public runner plan api"
```

---

## Task 6: Add Public Plan Route To Runner

**Files:**
- Create: `apps/runner/src/lib/publicPlanApi.ts`
- Create: `apps/runner/src/pages/PublicPlan.tsx`
- Modify: `apps/runner/src/App.tsx`

- [ ] **Step 1: Create runner API client**

Create `apps/runner/src/lib/publicPlanApi.ts`:

```ts
const FLOW_API_BASE_URL =
  import.meta.env.VITE_FLOW_API_BASE_URL || window.location.origin;

export type PublicRunnerPlanResponse = {
  profile: {
    id: string;
    phone: string;
    normalized_phone: string;
    generation_status: "idle" | "generating" | "completed" | "failed";
    last_error: string | null;
  } | null;
  plan: {
    id: string;
    goal_type: string;
    goal_distance: number | null;
    race_date: string | null;
    start_date: string | null;
    total_weeks: number;
    total_distance: number | null;
    completed_distance: number | null;
    completed_weeks: number | null;
  } | null;
  trainings: Array<{
    id: string;
    week_number: number;
    day_of_week: string;
    date: string;
    type: string;
    name: string;
    title: string;
    description: string | null;
    distance: number;
    duration: number;
    elapsed_time: number;
    completed: boolean;
  }>;
  webAppLink?: string;
};

export async function fetchPublicRunnerPlan(phone: string) {
  const response = await fetch(
    `${FLOW_API_BASE_URL}/api/runner/plans/${encodeURIComponent(phone)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar o plano.");
  }

  return (await response.json()) as PublicRunnerPlanResponse;
}

export async function generatePublicRunnerPlan(phone: string) {
  const response = await fetch(
    `${FLOW_API_BASE_URL}/api/runner/plans/${encodeURIComponent(phone)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel gerar o plano."
    );
  }

  return (await response.json()) as PublicRunnerPlanResponse;
}
```

- [ ] **Step 2: Create public page**

Create `apps/runner/src/pages/PublicPlan.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPublicRunnerPlan,
  generatePublicRunnerPlan,
  type PublicRunnerPlanResponse,
} from "@/lib/publicPlanApi";

function formatKm(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return numeric.toFixed(numeric % 1 === 0 ? 0 : 1).replace(".", ",");
}

function groupByWeek(trainings: PublicRunnerPlanResponse["trainings"]) {
  const map = new Map<number, PublicRunnerPlanResponse["trainings"]>();
  for (const training of trainings) {
    const list = map.get(training.week_number) || [];
    list.push(training);
    map.set(training.week_number, list);
  }
  return Array.from(map.entries()).sort(([left], [right]) => left - right);
}

export default function PublicPlan() {
  const { phone = "" } = useParams();
  const [data, setData] = useState<PublicRunnerPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(
    () => groupByWeek(data?.trainings || []),
    [data?.trainings]
  );

  useEffect(() => {
    let alive = true;

    fetchPublicRunnerPlan(phone)
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((requestError) => {
        if (!alive) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar o plano."
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [phone]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const payload = await generatePublicRunnerPlan(phone);
      setData(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel gerar o plano."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <header className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">BoraRun</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Seu plano de corrida
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Link publico do WhatsApp para {phone}
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!data?.plan && (
          <section className="rounded-2xl bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Plano ainda nao gerado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vou montar seu plano com base nas respostas enviadas pelo WhatsApp.
            </p>
            <Button
              className="mt-5 w-full"
              onClick={generate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando plano
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar meu plano
                </>
              )}
            </Button>
          </section>
        )}

        {data?.plan && (
          <>
            <section className="rounded-2xl bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Objetivo</p>
              <h2 className="mt-1 text-2xl font-bold">
                {data.plan.goal_type || "Corrida"}
              </h2>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold">{data.plan.total_weeks}</p>
                  <p className="text-xs text-muted-foreground">semanas</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold">
                    {formatKm(data.plan.total_distance)}
                  </p>
                  <p className="text-xs text-muted-foreground">km</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold">{data.trainings.length}</p>
                  <p className="text-xs text-muted-foreground">treinos</p>
                </div>
              </div>
            </section>

            <section className="mt-5 space-y-4">
              {weeks.map(([weekNumber, trainings]) => (
                <article
                  key={weekNumber}
                  className="rounded-2xl bg-card p-5 shadow-sm"
                >
                  <h3 className="text-xl font-bold">Semana {weekNumber}</h3>
                  <div className="mt-4 space-y-3">
                    {trainings.map((training) => (
                      <div
                        key={training.id}
                        className="rounded-xl border border-border p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{training.title}</p>
                          <p className="text-sm font-semibold">
                            {formatKm(training.distance)} km
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {training.day_of_week} · {training.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Register public route outside auth and subscription wrappers**

Modify `apps/runner/src/App.tsx`.

Add import:

```ts
import PublicPlan from "./pages/PublicPlan";
```

Add this route before all protected routes:

```tsx
<Route path="/plano/:phone" element={<PublicPlan />} />
```

Keep the existing `SubscriptionProvider` wrapper for now. The public page must not call subscription hooks.

- [ ] **Step 4: Build runner**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\runner"
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 5: Commit public route**

Run:

```powershell
git add apps/runner/src/lib/publicPlanApi.ts apps/runner/src/pages/PublicPlan.tsx apps/runner/src/App.tsx
git commit -m "feat: add public runner plan route"
```

---

## Task 7: Add The Web App Flow Node UI

**Files:**
- Modify: `apps/web/src/types/flow.ts`
- Modify: `apps/web/src/types/node-data.ts`
- Modify: `apps/web/src/lib/constants.ts`
- Create: `apps/web/src/components/nodes/web-app-node.tsx`
- Create: `apps/web/src/components/editors/web-app-editor.tsx`
- Modify: `apps/web/src/components/canvas/flow-canvas.tsx`
- Modify: `apps/web/src/components/layout/flow-sidebar.tsx`
- Modify: `apps/web/src/components/editors/node-editor-panel.tsx`

- [ ] **Step 1: Add node type**

Modify `apps/web/src/types/flow.ts`.

Add to `NODE_TYPES` after `GENERATE_PDF`:

```ts
  WEB_APP: "webApp",
```

- [ ] **Step 2: Add node data type**

Modify `apps/web/src/types/node-data.ts`.

Add `WebAppNodeData` to the `NodeData` union after `GeneratePdfNodeData`:

```ts
  | WebAppNodeData
```

Add this type after `GeneratePdfNodeData`:

```ts
export type WebAppGenerationMode = "generate_before_send" | "generate_in_app";

export type WebAppNodeData = {
  type: "webApp";
  label: string;
  messageText?: string;
  ctaButtonText?: string;
  generationMode: WebAppGenerationMode;
  aiPrompt?: string;
  fallbackMessageText?: string;
  [key: string]: unknown;
};
```

- [ ] **Step 3: Add constants**

Modify `apps/web/src/lib/constants.ts`.

Add after `NODE_TYPES.GENERATE_PDF`:

```ts
  [NODE_TYPES.WEB_APP]: {
    label: "Web App",
    color: "#16A34A",
    description: "Envia o link publico do app de treino para o usuario",
  },
```

- [ ] **Step 4: Create visual node**

Create `apps/web/src/components/nodes/web-app-node.tsx`:

```tsx
"use client";

import type { NodeProps } from "@xyflow/react";
import { Smartphone } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { WebAppNodeData } from "@/types/node-data";

export function WebAppNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WebAppNodeData;
  const config = NODE_CONFIG[NODE_TYPES.WEB_APP];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Smartphone size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="space-y-1">
        <div className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">
          {nodeData.generationMode === "generate_before_send"
            ? "gera antes do link"
            : "gera no app"}
        </div>
        <p className="line-clamp-2 text-gray-500">
          {nodeData.messageText || "Envia {{web_app_link}}"}
        </p>
      </div>
    </NodeWrapper>
  );
}
```

- [ ] **Step 5: Create editor**

Create `apps/web/src/components/editors/web-app-editor.tsx`:

```tsx
"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { WebAppNodeData } from "@/types/node-data";

interface WebAppEditorProps {
  nodeId: string;
  data: WebAppNodeData;
}

const DEFAULT_MESSAGE =
  "Montei seu plano de corrida em uma experiencia interativa:\n\n{{web_app_link}}\n\nPor ali voce consegue ver as semanas, treinos e proximos passos com mais clareza.";

export function WebAppEditor({ nodeId, data }: WebAppEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<WebAppNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do no</Label>
        <Input
          value={data.label}
          onChange={(event) => update({ label: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Modo de geracao</Label>
        <select
          value={data.generationMode || "generate_in_app"}
          onChange={(event) =>
            update({
              generationMode: event.target.value as WebAppNodeData["generationMode"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
        >
          <option value="generate_in_app">Gerar quando abrir o app</option>
          <option value="generate_before_send">Gerar antes de enviar o link</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>Texto do botao (opcional)</Label>
        <Input
          value={data.ctaButtonText || ""}
          onChange={(event) => update({ ctaButtonText: event.target.value })}
          placeholder="Ex: Abrir plano"
        />
        <p className="text-xs text-slate-400">
          Se preenchido, envia um botao clicavel com a URL do app.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Mensagem</Label>
        <Textarea
          rows={6}
          value={data.messageText || ""}
          onChange={(event) => update({ messageText: event.target.value })}
          placeholder={DEFAULT_MESSAGE}
        />
        <p className="text-xs text-slate-400">
          Use <code className="text-green-700">{"{{web_app_link}}"}</code> para
          inserir o link publico do app.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Prompt da IA (opcional)</Label>
        <Textarea
          rows={4}
          value={data.aiPrompt || ""}
          onChange={(event) => update({ aiPrompt: event.target.value })}
          placeholder="Instrucoes customizadas para gerar o plano no app..."
        />
      </div>

      <div className="space-y-2">
        <Label>Mensagem de erro (opcional)</Label>
        <Textarea
          rows={3}
          value={data.fallbackMessageText || ""}
          onChange={(event) =>
            update({ fallbackMessageText: event.target.value })
          }
          placeholder="Tive um problema ao preparar seu plano agora. Vou tentar novamente em instantes."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Register node in canvas**

Modify `apps/web/src/components/canvas/flow-canvas.tsx`.

Add imports:

```ts
import { WebAppNode } from "@/components/nodes/web-app-node";
```

```ts
  WebAppNodeData,
```

Add to `nodeTypes`:

```ts
  [NODE_TYPES.WEB_APP]: WebAppNode,
```

Add a default data case after `GENERATE_PDF`:

```ts
    case NODE_TYPES.WEB_APP:
      return {
        type: "webApp",
        label: "Web App",
        generationMode: "generate_in_app",
        messageText: "",
        ctaButtonText: "Abrir plano",
      } satisfies WebAppNodeData;
```

- [ ] **Step 7: Add palette item**

Modify `apps/web/src/components/layout/flow-sidebar.tsx`.

Add `Smartphone` to the lucide import.

Add after the PDF item:

```tsx
  {
    type: NODE_TYPES.WEB_APP,
    icon: <Smartphone size={20} />,
    ...NODE_CONFIG[NODE_TYPES.WEB_APP],
  },
```

- [ ] **Step 8: Add editor panel branch**

Modify `apps/web/src/components/editors/node-editor-panel.tsx`.

Add import:

```ts
import { WebAppEditor } from "./web-app-editor";
```

Add `WebAppNodeData` to the type import list.

Add after the `generatePdf` branch:

```tsx
          {nodeData.type === "webApp" && (
            <WebAppEditor
              nodeId={selectedNodeId}
              data={nodeData as WebAppNodeData}
            />
          )}
```

- [ ] **Step 9: Build web**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
npm run build
```

Expected: build succeeds and `WEB_APP` type references compile.

- [ ] **Step 10: Commit UI node**

Run:

```powershell
git add apps/web/src/types apps/web/src/lib/constants.ts apps/web/src/components
git commit -m "feat: add web app flow node"
```

---

## Task 8: Execute The Web App Node In The Flow Engine

**Files:**
- Modify: `apps/web/src/lib/flow-engine.ts`

- [ ] **Step 1: Add imports**

Modify `apps/web/src/lib/flow-engine.ts`.

Add `WebAppNodeData` to the node-data import list.

Add imports:

```ts
import { generateTrainingPlanData } from "@/lib/training-plan-generator";
import { buildRunnerPlanUrl, getRunnerAppBaseUrl } from "@/lib/runner/url";
import {
  ensureRunnerProfile,
  persistRunnerPlan,
} from "@/lib/runner/plan-store";
```

- [ ] **Step 2: Update estimated node cost**

In `getEstimatedNodeCostMs`, add:

```ts
    case "webApp":
      return 8_000;
```

Place it near `stravaConnect` and `whatsappFlow`.

- [ ] **Step 3: Add executor helper**

Add this helper above `executeGeneratePdfNode`:

```ts
const DEFAULT_WEB_APP_MESSAGE =
  "Montei seu plano de corrida em uma experiencia interativa:\n\n{{web_app_link}}\n\nPor ali voce consegue ver as semanas, treinos e proximos passos com mais clareza.";

async function executeWebAppNode(params: {
  supabase: SupabaseClient;
  organizationId: string;
  metaConfig: MetaConfig;
  conversationId: string;
  contactPhone: string;
  node: FlowNode;
  data: WebAppNodeData;
  inboundMessageId?: string;
}) {
  const flowVariables = await getConversationVariables(
    params.supabase,
    params.conversationId
  );
  const runnerProfile = await ensureRunnerProfile({
    supabase: params.supabase,
    phone: params.contactPhone,
    conversationId: params.conversationId,
    organizationId: params.organizationId,
  });
  const webAppLink = buildRunnerPlanUrl({
    baseUrl: getRunnerAppBaseUrl(),
    phone: params.contactPhone,
  });

  let updatedVars = {
    ...flowVariables,
    _runner_app_link: webAppLink,
  };

  if (params.data.generationMode === "generate_before_send") {
    await params.supabase
      .from("runner_profiles")
      .update({ generation_status: "generating", last_error: null })
      .eq("id", runnerProfile.id);

    try {
      const stravaContext = await buildStravaCoachContext(
        params.supabase,
        params.conversationId
      );
      const { planData, coachingSummary } = await generateTrainingPlanData({
        flowVariables,
        aiPrompt: params.data.aiPrompt,
        stravaContext: stravaContext || undefined,
      });

      updatedVars = {
        ...updatedVars,
        _training_plan: JSON.stringify(planData),
        _coaching_summary: JSON.stringify(coachingSummary),
        _plan_generated_at: new Date().toISOString(),
      };

      await params.supabase
        .from("conversations")
        .update({ flow_variables: updatedVars })
        .eq("id", params.conversationId);

      await persistRunnerPlan({
        supabase: params.supabase,
        runnerProfileId: runnerProfile.id,
        conversationId: params.conversationId,
        organizationId: params.organizationId,
        startDate: new Date().toISOString().slice(0, 10),
        planData,
        coachingSummary,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate plan";
      await params.supabase
        .from("runner_profiles")
        .update({ generation_status: "failed", last_error: message })
        .eq("id", runnerProfile.id);
      throw error;
    }
  } else {
    await params.supabase
      .from("conversations")
      .update({ flow_variables: updatedVars })
      .eq("id", params.conversationId);
  }

  const message = interpolateVariables(
    (params.data.messageText || DEFAULT_WEB_APP_MESSAGE).replace(
      /\{\{web_app_link\}\}/g,
      webAppLink
    ),
    updatedVars
  );

  if (params.data.ctaButtonText?.trim()) {
    const bodyText = interpolateVariables(
      (params.data.messageText || DEFAULT_WEB_APP_MESSAGE)
        .replace(/\{\{web_app_link\}\}/g, "")
        .trim(),
      updatedVars
    );

    const result = await sendMetaWhatsAppCtaUrlMessage(
      {
        to: params.contactPhone,
        bodyText: bodyText || "Abra seu plano de corrida no app:",
        buttonText: params.data.ctaButtonText,
        url: webAppLink,
      },
      params.metaConfig
    );

    await persistConversationMessage({
      supabase: params.supabase,
      conversationId: params.conversationId,
      content: bodyText || message,
      type: "interactive",
      sender: "bot",
      nodeId: params.node.id,
      waMessageId: result.messageId,
      metadata: {
        runner_app_url: webAppLink,
        whatsapp_interactive_kind: "cta_url",
        whatsapp_button_text: params.data.ctaButtonText,
      },
    });
    return;
  }

  await sendTextAndPersist({
    supabase: params.supabase,
    conversationId: params.conversationId,
    contactPhone: params.contactPhone,
    nodeId: params.node.id,
    text: message,
    metaConfig: params.metaConfig,
    inboundMessageId: params.inboundMessageId,
  });
}
```

- [ ] **Step 4: Call executor in flow loop**

In the main flow loop, add this branch after `generatePdf` and before `aiCollector`:

```ts
    if (data.type === "webApp") {
      try {
        await executeWebAppNode({
          supabase: params.supabase,
          organizationId: params.organizationId,
          metaConfig: params.metaConfig,
          conversationId: params.conversationId,
          contactPhone: params.contactPhone,
          node: current,
          data: data as WebAppNodeData,
          inboundMessageId: params.inboundMessageId,
        });
      } catch (error) {
        console.error("Flow engine: failed to send runner web app link", error);
        const webAppData = data as WebAppNodeData;
        await sendTextAndPersist({
          supabase: params.supabase,
          conversationId: params.conversationId,
          contactPhone: params.contactPhone,
          nodeId: current.id,
          text:
            webAppData.fallbackMessageText?.trim() ||
            "Tive um problema ao preparar seu plano agora. Vou tentar novamente em instantes.",
          metaConfig: params.metaConfig,
          inboundMessageId: params.inboundMessageId,
        }).catch((messageError) => {
          console.error(
            "Flow engine: failed to send web app failure notification",
            messageError
          );
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 900));
    }
```

- [ ] **Step 5: Run web tests and build**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
node --test src/lib/runner/plan-store.test.mjs src/lib/training-plan-generator.test.mjs
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 6: Commit flow execution**

Run:

```powershell
git add apps/web/src/lib/flow-engine.ts
git commit -m "feat: send runner app links from flows"
```

---

## Task 9: End-To-End Local Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Start the flow builder backend**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
$env:RUNNER_APP_BASE_URL="http://localhost:5173"
$env:RUNNER_APP_ALLOWED_ORIGIN="http://localhost:5173"
npm run dev
```

Expected: Next.js serves on `http://localhost:3000` or prints the selected port.

- [ ] **Step 2: Start the runner app**

In a second terminal:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\runner"
$env:VITE_FLOW_API_BASE_URL="http://localhost:3000"
npm run dev
```

Expected: Vite serves on `http://localhost:5173`.

- [ ] **Step 3: Verify the runner public route loads**

Open:

```text
http://localhost:5173/plano/5511999999999
```

Expected: page renders without redirecting to auth. If no runner profile exists, it shows the "Plano ainda nao gerado" state or an API-not-found message rather than the auth page.

- [ ] **Step 4: Verify flow builder UI**

Open the flow builder, add the `Web App` node from the palette, and set:

```text
Mensagem:
Montei seu plano no app:

{{web_app_link}}

Modo de geracao:
Gerar quando abrir o app

Texto do botao:
Abrir plano
```

Expected: node saves config, remains connected in the canvas, and build remains clean after saving.

- [ ] **Step 5: Verify existing PDF node still builds**

Run:

```powershell
cd "C:\Users\rodri\Desktop\Flows BoraRun\apps\web"
npm run build
```

Expected: build succeeds with the PDF node code still present.

- [ ] **Step 6: Commit verification fixes only if changes were required**

If verification required source fixes, run:

```powershell
git add apps/web apps/runner supabase/migrations
git commit -m "fix: stabilize runner app integration"
```

If no source fixes were required, do not create a commit.

---

## Self-Review

Spec coverage:

- Full BoraRun app migration is covered by Task 1.
- No-login public phone route is covered by Task 6 and Task 9.
- Server-side AI generation is covered by Task 3 and Task 5.
- Supabase public runner bridge is covered by Task 2 and Task 4.
- New `Web App` node UI is covered by Task 7.
- Flow-engine execution is covered by Task 8.
- Auth and subscription bypass are covered by the `/plano/:phone` route staying outside `ProtectedRoute` and by using public APIs rather than subscription context.
- Existing PDF flow preservation is covered by Task 3 refactor verification and Task 9 build verification.

Placeholder scan:

- The plan uses concrete paths, commands, SQL, and code snippets.
- Dynamic Supabase migration filename is captured by command output and immediately written in the next step.

Type consistency:

- Node type is `webApp`.
- Node data type is `WebAppNodeData`.
- Generation modes are `generate_before_send` and `generate_in_app`.
- Runner link variable is `{{web_app_link}}`.
