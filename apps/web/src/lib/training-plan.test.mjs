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
    require,
  });
  return cjsModule.exports;
}

const { normalizeTrainingPlan } = loadTypeScriptModule("./training-plan.ts");

test("preserves numeric distancia_km values as explicit kilometers", () => {
  const result = normalizeTrainingPlan({
    semanas: [
      {
        dias: [
          {
            dia: "terça-feira",
            tipo: "Intervalado",
            treino: "8 x 400 m forte controlado",
            distancia_km: 13,
            duracao_min: 70,
          },
        ],
      },
    ],
  });

  assert.equal(result.semanas[0].dias[0].distancia_km, "13");
  assert.equal(result.semanas[0].dias[0].distancia_km_estimado, false);
});

test("estimates distance from numeric duracao_min instead of tiny interval fragments", () => {
  const result = normalizeTrainingPlan({
    perfil_atleta: { nivel: "iniciante" },
    semanas: [
      {
        volume_total_km: "12",
        dias: [
          {
            dia: "quarta-feira",
            tipo: "Intervalado",
            parte_principal: "6x (1 min forte controlado + 2 min leve)",
            duracao_min: 28,
            pace_alvo: "forte controlado",
          },
        ],
      },
    ],
  });

  const distance = Number(result.semanas[0].dias[0].distancia_km);

  assert.ok(distance >= 3, `expected at least 3 km, got ${distance}`);
  assert.ok(distance <= 6, `expected at most 6 km, got ${distance}`);
});

test("does not inflate one estimated workout just to match weekly volume", () => {
  const result = normalizeTrainingPlan({
    perfil_atleta: { nivel: "intermediario" },
    semanas: [
      {
        volume_total_km: "86",
        dias: [
          {
            dia: "segunda-feira",
            tipo: "Corrida leve",
            distancia_km: "10",
            duracao_min: 56,
          },
          {
            dia: "quinta-feira",
            tipo: "Intervalado",
            parte_principal: "3 x 10 min em limiar com 2 min trote entre blocos",
            duracao_min: 78,
            pace_alvo: "limiar",
          },
          {
            dia: "sabado",
            tipo: "Longao",
            distancia_km: "20",
            duracao_min: 155,
          },
        ],
      },
    ],
  });

  const distance = Number(result.semanas[0].dias[1].distancia_km);

  assert.ok(distance >= 10, `expected at least 10 km, got ${distance}`);
  assert.ok(distance <= 20, `expected at most 20 km, got ${distance}`);
});
