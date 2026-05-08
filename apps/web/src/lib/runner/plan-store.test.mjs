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
