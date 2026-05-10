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
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL,
  DEFAULT_TRAINING_PLAN_MODEL,
  getChatCompletionTemperatureParams,
  getChatCompletionTokenParams,
} = loadTypeScriptModule("./ai-models.ts");

test("uses gpt-5.5 as the default AI model exposed in model selectors", () => {
  assert.equal(DEFAULT_AI_MODEL, "gpt-5.5");
  assert.equal(AI_MODEL_OPTIONS[0].value, "gpt-5.5");
});

test("keeps structured training plan generation on the faster planner model", () => {
  assert.equal(DEFAULT_TRAINING_PLAN_MODEL, "gpt-5.4-mini");
  assert.notEqual(DEFAULT_TRAINING_PLAN_MODEL, DEFAULT_AI_MODEL);
});

test("omits temperature for gpt-5 chat completion models", () => {
  assert.deepEqual(
    Object.entries(getChatCompletionTemperatureParams("gpt-5.5", 0.7)),
    []
  );
  assert.deepEqual(
    Object.entries(getChatCompletionTemperatureParams("gpt-5.4-mini", 0.7)),
    []
  );
  assert.deepEqual(
    Object.entries(getChatCompletionTemperatureParams("gpt-4o", 0.7)),
    [["temperature", 0.7]]
  );
});

test("uses the gpt-5 completion token parameter name only for gpt-5 models", () => {
  assert.deepEqual(
    Object.entries(getChatCompletionTokenParams("gpt-5.5", 500)),
    [["max_completion_tokens", 500]]
  );
  assert.deepEqual(
    Object.entries(getChatCompletionTokenParams("gpt-4o", 500)),
    [["max_tokens", 500]]
  );
});
