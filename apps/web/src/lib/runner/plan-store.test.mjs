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
  const customRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(requireOverrides, specifier)) {
      return requireOverrides[specifier];
    }
    return require(specifier);
  };

  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require: customRequire,
    process,
    console,
    URL,
    setTimeout,
    clearTimeout,
  });
  return cjsModule.exports;
}

const { normalizeRunnerPhone } = loadTypeScriptModule("./phone.ts");
const { buildRunnerPlanUrl, getRunnerAppBaseUrl } = loadTypeScriptModule(
  "./url.ts",
  {
    "@/lib/runner/phone": { normalizeRunnerPhone },
  }
);
const { mapPlanToRunnerRows } = loadTypeScriptModule("./plan-mapper.ts");
const { buildRunnerWebAppMessage } = loadTypeScriptModule("./web-app-message.ts");
const {
  coercePartialConflictRunnerPlanToGenerating,
  ensureRunnerProfile,
  generateAndPersistRunnerPlan,
  getCompletedPublicRunnerPlanAfterConflict,
  isUniqueViolation,
  sanitizeRunnerPlanForPublic,
  sanitizeRunnerProfileForPublic,
  sanitizeRunnerTrainingForPublic,
} = loadTypeScriptModule("./plan-store.ts", {
  "@/lib/runner/phone": { normalizeRunnerPhone },
  "@/lib/runner/plan-mapper": { mapPlanToRunnerRows },
  "@/lib/training-plan-generator": {
    generateTrainingPlanData: async () => {
      throw new Error("generateTrainingPlanData should be injected in tests");
    },
  },
});

function asJson(value) {
  return JSON.parse(JSON.stringify(value));
}

test("normalizes phone to digits", () => {
  assert.equal(normalizeRunnerPhone("+55 (11) 99999-0000"), "5511999990000");
});

test("builds phone-based runner URL from trailing-slash base URL", () => {
  assert.equal(
    buildRunnerPlanUrl({
      baseUrl: "https://runner.example.com/",
      phone: "+55 (11) 99999-0000",
    }),
    "https://runner.example.com/plano/5511999990000"
  );
});

test("rejects missing runner URL base", () => {
  assert.throws(
    () =>
      buildRunnerPlanUrl({
        baseUrl: "   ",
        phone: "+55 (11) 99999-0000",
      }),
    /absolute http\(s\) base URL/i
  );
});

test("rejects non-http runner URL base", () => {
  assert.throws(
    () =>
      buildRunnerPlanUrl({
        baseUrl: "ftp://runner.example.com",
        phone: "+55 (11) 99999-0000",
      }),
    /absolute http\(s\) base URL/i
  );
});

test("chooses and trims runner app base URL", () => {
  const previousRunnerBaseUrl = process.env.RUNNER_APP_BASE_URL;
  const previousPublicRunnerBaseUrl =
    process.env.NEXT_PUBLIC_RUNNER_APP_BASE_URL;

  try {
    process.env.RUNNER_APP_BASE_URL = "";
    process.env.NEXT_PUBLIC_RUNNER_APP_BASE_URL =
      "https://public-runner.example.com///";

    assert.equal(
      getRunnerAppBaseUrl("https://request.example.com/"),
      "https://public-runner.example.com"
    );

    process.env.RUNNER_APP_BASE_URL = "https://runner.example.com//";

    assert.equal(
      getRunnerAppBaseUrl("https://request.example.com/"),
      "https://runner.example.com"
    );
  } finally {
    if (previousRunnerBaseUrl === undefined) {
      delete process.env.RUNNER_APP_BASE_URL;
    } else {
      process.env.RUNNER_APP_BASE_URL = previousRunnerBaseUrl;
    }

    if (previousPublicRunnerBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_RUNNER_APP_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_RUNNER_APP_BASE_URL =
        previousPublicRunnerBaseUrl;
    }
  }
});

test("builds runner web app message with explicit link placeholder", () => {
  assert.equal(
    buildRunnerWebAppMessage({
      template: "Oi {{nome}}, seu plano esta aqui: {{web_app_link}}",
      link: "https://runner.example.com/plano/5511999990000",
      variables: { nome: "Ana" },
    }),
    "Oi Ana, seu plano esta aqui: https://runner.example.com/plano/5511999990000"
  );
});

test("appends runner web app link when template omits placeholder", () => {
  assert.equal(
    buildRunnerWebAppMessage({
      template: "Seu plano esta pronto.",
      link: "https://runner.example.com/plano/5511999990000",
    }),
    "Seu plano esta pronto.\n\nhttps://runner.example.com/plano/5511999990000"
  );
});

test("ensureRunnerProfile can reset stale plan for a new web app link", async () => {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(["from", table]);

      if (table === "runner_profiles") {
        return {
          upsert(payload, options) {
            calls.push(["upsert", payload, options]);
            return {
              select() {
                calls.push(["select"]);
                return {
                  async single() {
                    calls.push(["single"]);
                    return {
                      data: { id: "profile-1", ...payload },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "training_plans") {
        return {
          delete() {
            calls.push(["delete"]);
            return {
              async eq(column, value) {
                calls.push(["eq", column, value]);
                return { error: null };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const profile = await ensureRunnerProfile({
    supabase,
    phone: "+55 (11) 99999-0000",
    conversationId: "conversation-2",
    organizationId: "organization-1",
    resetExistingPlan: true,
  });

  assert.equal(profile.normalized_phone, "5511999990000");
  assert.deepEqual(asJson(calls[1]), [
    "upsert",
    {
      phone: "+55 (11) 99999-0000",
      normalized_phone: "5511999990000",
      conversation_id: "conversation-2",
      organization_id: "organization-1",
      generation_status: "idle",
      generated_at: null,
      last_error: null,
    },
    { onConflict: "normalized_phone" },
  ]);
  assert.deepEqual(calls.at(-1), ["eq", "runner_profile_id", "profile-1"]);
});

test("generateAndPersistRunnerPlan saves an AI plan before returning the public plan", async () => {
  const statusUpdates = [];
  const conversationUpdates = [];
  const generatedInputs = [];
  const persistedCalls = [];
  const publicPlan = {
    profile: { generation_status: "completed" },
    plan: { goal_type: "5 km" },
    trainings: [{ week_number: 1 }],
  };
  const supabase = {
    from(table) {
      if (table === "runner_profiles") {
        return {
          update(payload) {
            statusUpdates.push(payload);
            return {
              async eq(column, value) {
                statusUpdates.push({ column, value });
                return { error: null };
              },
            };
          },
        };
      }

      if (table === "conversations") {
        return {
          update(payload) {
            conversationUpdates.push(payload);
            return {
              async eq(column, value) {
                conversationUpdates.push({ column, value });
                return { error: null };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await generateAndPersistRunnerPlan({
    supabase,
    runnerProfileId: "profile-1",
    conversationId: "conversation-1",
    organizationId: "organization-1",
    flowVariables: {
      objetivo: "Correr 5 km",
      data_inicio_plano: "2026-05-12",
      web_app_link: "https://runner.example.com/plano/5511999990000",
    },
    now: () => new Date("2026-05-08T12:00:00.000Z"),
    generatePlanData: async ({ flowVariables }) => {
      generatedInputs.push(flowVariables);
      return {
        planData: {
          perfil_atleta: { objetivo: "Correr 5 km" },
          semanas: [],
        },
        coachingSummary: { risco: "baixo" },
      };
    },
    persistPlan: async (params) => {
      persistedCalls.push(params);
      return publicPlan;
    },
  });

  assert.deepEqual(asJson(statusUpdates[0]), {
    generation_status: "generating",
    last_error: null,
  });
  assert.deepEqual(asJson(generatedInputs[0]), {
    objetivo: "Correr 5 km",
    data_inicio_plano: "2026-05-12",
    web_app_link: "https://runner.example.com/plano/5511999990000",
  });
  assert.equal(persistedCalls[0].runnerProfileId, "profile-1");
  assert.equal(persistedCalls[0].conversationId, "conversation-1");
  assert.equal(persistedCalls[0].organizationId, "organization-1");
  assert.equal(persistedCalls[0].startDate, "2026-05-12");
  assert.deepEqual(asJson(persistedCalls[0].planData), {
    perfil_atleta: { objetivo: "Correr 5 km" },
    semanas: [],
  });

  const savedVariables = conversationUpdates[0].flow_variables;
  assert.equal(savedVariables._plan_generated_at, "2026-05-08T12:00:00.000Z");
  assert.equal(
    savedVariables._training_plan,
    JSON.stringify({
      perfil_atleta: { objetivo: "Correr 5 km" },
      semanas: [],
    })
  );
  assert.equal(savedVariables._coaching_summary, JSON.stringify({ risco: "baixo" }));
  assert.deepEqual(asJson(result.publicPlan), publicPlan);
  assert.deepEqual(asJson(result.flowVariables), asJson(savedVariables));
});

test("maps plan weeks and days to Monday-based runner rows", () => {
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

  assert.equal(result.plan.runner_profile_id, "profile-1");
  assert.equal(result.plan.total_weeks, 1);
  assert.equal(result.plan.total_distance, 7);
  assert.equal(result.trainings.length, 2);
  assert.equal(result.trainings[0].training_plan_id, "plan-1");
  assert.equal(result.trainings[0].date, "2026-05-11");
  assert.equal(result.trainings[0].day_of_week, "Segunda");
  assert.equal(result.trainings[0].type, "easy");
  assert.equal(result.trainings[0].elapsed_time, 1440);
  assert.equal(result.trainings[1].date, "2026-05-13");
  assert.equal(result.trainings[1].day_of_week, "Quarta");
  assert.equal(result.trainings[1].type, "long");
});

test("anchors non-Monday start dates to the Monday of that week", () => {
  const result = mapPlanToRunnerRows({
    runnerProfileId: "profile-1",
    trainingPlanId: "plan-1",
    startDate: "2026-05-08",
    planData: {
      semanas: [
        {
          semana: 1,
          dias: [
            {
              dia: "Segunda",
              treino: "Rodagem leve",
              distancia_km: "3",
            },
            {
              dia: "Quarta",
              treino: "Tiros curtos",
              distancia_km: "4",
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.trainings[0].date, "2026-05-04");
  assert.equal(result.trainings[1].date, "2026-05-06");
});

test("infers long and interval training types from Portuguese plan text", () => {
  const result = mapPlanToRunnerRows({
    runnerProfileId: "profile-1",
    trainingPlanId: "plan-1",
    startDate: "2026-05-11",
    planData: {
      semanas: [
        {
          semana: 1,
          dias: [
            {
              dia: "Sabado",
              treino: "Longão progressivo",
              distancia_km: "12",
            },
            {
              dia: "Terca",
              treino: "Tiros de 400m",
              descricao: "Treino intervalado na pista",
              distancia_km: "5",
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.trainings[0].type, "long");
  assert.equal(result.trainings[1].type, "interval");
});

test("sanitizes public runner profile fields", () => {
  const publicProfile = sanitizeRunnerProfileForPublic({
    id: "profile-1",
    phone: "+55 11 99999-0000",
    normalized_phone: "5511999990000",
    generation_status: "completed",
    generated_at: "2026-05-08T10:00:00.000Z",
    last_error: null,
    public_access_key: "secret",
    conversation_id: "conversation-1",
    organization_id: "organization-1",
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-02T10:00:00.000Z",
  });

  assert.deepEqual(asJson(publicProfile), {
    phone: "+55 11 99999-0000",
    normalized_phone: "5511999990000",
    generation_status: "completed",
    generated_at: "2026-05-08T10:00:00.000Z",
    last_error: null,
  });
});

test("sanitizes public runner plan fields", () => {
  const publicPlan = sanitizeRunnerPlanForPublic({
    id: "plan-1",
    runner_profile_id: "profile-1",
    conversation_id: "conversation-1",
    organization_id: "organization-1",
    raw_plan: { hidden: true },
    coaching_summary: { hidden: true },
    goal_type: "distance",
    goal_distance: 5,
    race_date: "2026-07-01",
    start_date: "2026-05-11",
    total_weeks: 8,
    total_distance: 120,
    completed_distance: 10,
    completed_weeks: 1,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-02T10:00:00.000Z",
  });

  assert.deepEqual(asJson(publicPlan), {
    goal_type: "distance",
    goal_distance: 5,
    race_date: "2026-07-01",
    start_date: "2026-05-11",
    total_weeks: 8,
    total_distance: 120,
    completed_distance: 10,
    completed_weeks: 1,
  });
});

test("sanitizes public runner training fields", () => {
  const publicTraining = sanitizeRunnerTrainingForPublic({
    id: "training-1",
    training_plan_id: "plan-1",
    week_number: 1,
    day_of_week: "Segunda",
    date: "2026-05-11",
    type: "easy",
    name: "Rodagem",
    title: "Rodagem leve",
    description: "3 km leve",
    distance: 3,
    pace: "8:00/km",
    duration: 24,
    elapsed_time: 1440,
    completed: true,
    completed_at: "2026-05-11T12:00:00.000Z",
    actual_distance: 3.1,
    actual_elapsed_time: 1450,
    actual_time: "00:24:10",
    actual_pace: "7:48/km",
    difficulty_level: 2,
    feedbacks: ["ok"],
    source: "plan",
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-02T10:00:00.000Z",
  });

  assert.deepEqual(asJson(publicTraining), {
    week_number: 1,
    day_of_week: "Segunda",
    date: "2026-05-11",
    type: "easy",
    name: "Rodagem",
    title: "Rodagem leve",
    description: "3 km leve",
    distance: 3,
    pace: "8:00/km",
    duration: 24,
    elapsed_time: 1440,
    completed: true,
    completed_at: "2026-05-11T12:00:00.000Z",
    actual_distance: 3.1,
    actual_elapsed_time: 1450,
    actual_time: "00:24:10",
    actual_pace: "7:48/km",
    difficulty_level: 2,
    feedbacks: ["ok"],
    source: "plan",
  });
});

test("detects postgres unique violations for idempotent reload", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(
    isUniqueViolation({ message: "duplicate key value violates unique constraint" }),
    true
  );
  assert.equal(isUniqueViolation({ code: "42P01", message: "missing table" }), false);
  assert.equal(isUniqueViolation(null), false);
});

test("coerces exhausted partial conflict result back to generating", () => {
  const publicPlan = coercePartialConflictRunnerPlanToGenerating({
    profile: {
      phone: "+55 11 99999-0000",
      normalized_phone: "5511999990000",
      generation_status: "generating",
      generated_at: null,
      last_error: null,
    },
    plan: {
      goal_type: "distance",
      goal_distance: 5,
      race_date: null,
      start_date: "2026-05-11",
      total_weeks: 8,
      total_distance: 120,
      completed_distance: 0,
      completed_weeks: 0,
    },
    trainings: [],
  });

  assert.deepEqual(asJson(publicPlan), {
    profile: {
      phone: "+55 11 99999-0000",
      normalized_phone: "5511999990000",
      generation_status: "generating",
      generated_at: null,
      last_error: null,
    },
    plan: null,
    trainings: [],
  });
});

test("keeps complete conflict result unchanged", () => {
  const withTraining = {
    profile: {
      phone: "+55 11 99999-0000",
      normalized_phone: "5511999990000",
      generation_status: "generating",
      generated_at: null,
      last_error: null,
    },
    plan: { goal_type: "distance" },
    trainings: [{ week_number: 1 }],
  };

  assert.deepEqual(
    asJson(coercePartialConflictRunnerPlanToGenerating(withTraining)),
    withTraining
  );
});

test("coerces terminal partial conflict result to no plan", () => {
  for (const generationStatus of ["completed", "failed"]) {
    const terminalWithoutTraining = {
      profile: {
        phone: "+55 11 99999-0000",
        normalized_phone: "5511999990000",
        generation_status: generationStatus,
        generated_at: "2026-05-08T10:00:00.000Z",
        last_error: generationStatus === "failed" ? "generation failed" : null,
      },
      plan: { goal_type: "distance" },
      trainings: [],
    };

    assert.deepEqual(
      asJson(
        coercePartialConflictRunnerPlanToGenerating(terminalWithoutTraining)
      ),
      {
        profile: terminalWithoutTraining.profile,
        plan: null,
        trainings: [],
      }
    );
  }
});

test("retries conflict reload until trainings are visible", async () => {
  const partial = {
    profile: {
      phone: "+55 11 99999-0000",
      normalized_phone: "5511999990000",
      generation_status: "generating",
      generated_at: null,
      last_error: null,
    },
    plan: { goal_type: "distance" },
    trainings: [],
  };
  const complete = {
    ...partial,
    trainings: [{ week_number: 1 }],
  };
  const calls = [];

  const result = await getCompletedPublicRunnerPlanAfterConflict({
    supabase: {},
    phone: "+55 11 99999-0000",
    attempts: 3,
    delayMs: 0,
    loadPublicPlan: async () => {
      calls.push(Date.now());
      return calls.length === 1 ? partial : complete;
    },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(asJson(result), complete);
});
