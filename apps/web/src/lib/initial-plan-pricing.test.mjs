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

const {
  buildInitialFreePlanPricingResponse,
  isInitialPlanPricingQuestion,
  shouldAnswerInitialPlanPricing,
} = loadTypeScriptModule("./initial-plan-pricing.ts");

test("detects short cost questions before the PDF", () => {
  assert.equal(isInitialPlanPricingQuestion("É pago ?"), true);
  assert.equal(isInitialPlanPricingQuestion("isso é pago?"), true);
  assert.equal(isInitialPlanPricingQuestion("tem que pagar?"), true);
  assert.equal(isInitialPlanPricingQuestion("quanto custa?"), true);
  assert.equal(isInitialPlanPricingQuestion("é grátis?"), true);
});

test("does not treat unrelated onboarding answers as pricing questions", () => {
  assert.equal(isInitialPlanPricingQuestion("tenho 34 anos e quero correr 5km"), false);
  assert.equal(isInitialPlanPricingQuestion("já corro 3km confortável"), false);
  assert.equal(isInitialPlanPricingQuestion("tive dor no joelho"), false);
});

test("only answers with the free PDF message before a plan exists", () => {
  assert.equal(shouldAnswerInitialPlanPricing("É pago?", {}), true);
  assert.equal(
    shouldAnswerInitialPlanPricing("É pago?", {
      _training_plan: "{}",
    }),
    false
  );
  assert.equal(
    shouldAnswerInitialPlanPricing("É pago?", {
      _plan_generated_at: "2026-04-30T12:00:00Z",
    }),
    false
  );
});

test("free initial plan response keeps plan terminology", () => {
  const response = buildInitialFreePlanPricingResponse();

  assert.match(response, /plano inicial/i);
  assert.match(response, /gratuito/i);
  assert.match(response, /plano pago de acompanhamento/i);
  assert.match(response, /s[oó]? ativa se quiser/i);
  assert.doesNotMatch(response, /PDF/i);
});
