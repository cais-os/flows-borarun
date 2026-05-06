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
  buildCustomDateRange,
  formatDateInputValue,
  getPresetRange,
} = loadTypeScriptModule("./date-range-utils.ts");

test("builds a custom range from local calendar dates", () => {
  const range = buildCustomDateRange("2026-04-01", "2026-04-30");
  const from = new Date(range.from);
  const to = new Date(range.to);

  assert.equal(from.getFullYear(), 2026);
  assert.equal(from.getMonth(), 3);
  assert.equal(from.getDate(), 1);
  assert.equal(from.getHours(), 0);
  assert.equal(from.getMinutes(), 0);
  assert.equal(to.getFullYear(), 2026);
  assert.equal(to.getMonth(), 3);
  assert.equal(to.getDate(), 30);
  assert.equal(to.getHours(), 23);
  assert.equal(to.getMinutes(), 59);
  assert.equal(formatDateInputValue(range.from), "2026-04-01");
  assert.equal(formatDateInputValue(range.to), "2026-04-30");
});

test("normalizes inverted custom dates", () => {
  const range = buildCustomDateRange("2026-04-30", "2026-04-01");

  assert.equal(formatDateInputValue(range.from), "2026-04-01");
  assert.equal(formatDateInputValue(range.to), "2026-04-30");
});

test("keeps preset ranges available for existing filters", () => {
  const now = new Date("2026-04-30T12:00:00");
  const range = getPresetRange("7d", now);

  assert.equal(getPresetRange("all", now).from, "");
  assert.equal(getPresetRange("all", now).to, "");
  assert.equal(
    new Date(range.to).getTime() - new Date(range.from).getTime(),
    7 * 24 * 60 * 60 * 1000
  );
});
