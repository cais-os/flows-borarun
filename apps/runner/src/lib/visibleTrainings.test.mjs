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
  filterVisibleTrainingsFromDate,
  getLocalDateKey,
  isVisibleTrainingFromDate,
} = loadTypeScriptModule("./visibleTrainings.ts");

test("formats a Date as a local calendar key", () => {
  assert.equal(getLocalDateKey(new Date(2026, 4, 10, 12)), "2026-05-10");
});

test("hides trainings dated before today and keeps today or future trainings", () => {
  const trainings = [
    { id: "monday", date: "2026-05-04" },
    { id: "wednesday", date: "2026-05-06" },
    { id: "saturday", date: "2026-05-09" },
    { id: "today", date: "2026-05-10" },
    { id: "next-monday", date: "2026-05-11" },
    { id: "missing-date", date: null },
  ];

  const visible = filterVisibleTrainingsFromDate(trainings, "2026-05-10");

  assert.deepEqual(
    visible.map((training) => training.id),
    ["today", "next-monday", "missing-date"]
  );
});

test("keeps trainings without a valid date instead of losing plan data", () => {
  assert.equal(isVisibleTrainingFromDate({ date: null }, "2026-05-10"), true);
  assert.equal(isVisibleTrainingFromDate({ date: "" }, "2026-05-10"), true);
});
