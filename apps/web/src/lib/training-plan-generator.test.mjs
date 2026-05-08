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
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const cjsModule = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier === "openai") {
      return {
        __esModule: true,
        default: class OpenAIStub {
          constructor() {
            this.chat = {
              completions: {
                create: async () => ({
                  choices: [{ message: { content: "{}" } }],
                }),
              },
            };
          }
        },
      };
    }
    if (specifier === "@/lib/prompts/planejador-inicial") {
      return { PLANEJADOR_INICIAL_PROMPT: "Default planner prompt" };
    }
    if (specifier === "@/lib/training-plan") {
      return { normalizeTrainingPlan: (plan) => plan };
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

const { buildTrainingPlanUserContent, parseTrainingPlanCompletion } =
  loadTypeScriptModule("./training-plan-generator.ts");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parseTrainingPlanCompletion parses training_plan and coaching_summary JSON", () => {
  const result = parseTrainingPlanCompletion(
    JSON.stringify({
      training_plan: {
        perfil_atleta: { nome: "Ana" },
        semanas: [{ semana: 1 }],
      },
      coaching_summary: {
        foco_do_ciclo: "base aerobica",
      },
    }),
    { flowVariables: { nome: "Ana" } }
  );

  assert.deepEqual(plain(result.planData), {
    perfil_atleta: { nome: "Ana" },
    semanas: [{ semana: 1 }],
  });
  assert.deepEqual(plain(result.coachingSummary), {
    foco_do_ciclo: "base aerobica",
  });
});

test("parseTrainingPlanCompletion falls back to root object when training_plan is absent", () => {
  const result = parseTrainingPlanCompletion(
    JSON.stringify({
      perfil_atleta: { nome: "Bia" },
      logica_plano: { objetivo: "5k" },
      semanas: [],
    }),
    { flowVariables: { nome: "Bia" } }
  );

  assert.deepEqual(plain(result.planData), {
    perfil_atleta: { nome: "Bia" },
    logica_plano: { objetivo: "5k" },
    semanas: [],
  });
  assert.deepEqual(plain(result.coachingSummary), {});
});

test("buildTrainingPlanUserContent includes flow variables and Strava context", () => {
  const content = buildTrainingPlanUserContent({
    flowVariables: {
      nome: "Caio",
      objetivo: "correr 10k",
    },
    stravaContext: "Ultima corrida: 5 km em ritmo leve",
  });

  assert.match(content, /^Informações do aluno:/);
  assert.match(content, /nome: Caio/);
  assert.match(content, /objetivo: correr 10k/);
  assert.match(content, /Dados do Strava:/);
  assert.match(content, /Ultima corrida: 5 km em ritmo leve/);
});

test("keeps the original PDF generator prompt wording", () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, "./training-plan-generator.ts"),
    "utf8"
  );

  assert.match(
    source,
    /const DEFAULT_INSTRUCTION = `Você é um treinador de corrida especialista\. Com base nas informações do aluno abaixo, gere um plano de treino personalizado\.`;/
  );
  assert.match(
    source,
    /const JSON_FORMAT_INSTRUCTION = `\n\nIMPORTANTE: Retorne APENAS um JSON válido \(sem markdown, sem código, sem explicações\) com EXATAMENTE 2 chaves raiz:\n1\. "training_plan" — com as sub-chaves: perfil_atleta, logica_plano, semanas\n2\. "coaching_summary" — com o resumo interno para o coach de acompanhamento`;/
  );
});
