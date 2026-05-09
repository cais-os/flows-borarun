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
  extractFirstScreenIdFromWhatsAppFlowJson,
  resolveWhatsAppFlowInitialScreenId,
} = loadTypeScriptModule("./whatsapp-flow-send.ts");

test("extracts the first screen id from a published WhatsApp Flow JSON", () => {
  assert.equal(
    extractFirstScreenIdFromWhatsAppFlowJson({
      version: "7.3",
      screens: [
        { id: "BOAS_VINDAS", title: "Bora Run" },
        { id: "DADOS_BASICOS", title: "Dados Basicos" },
      ],
    }),
    "BOAS_VINDAS"
  );
});

test("resolves external WhatsApp Flow initial screen from Meta assets when node has no firstScreenId", async () => {
  const calls = [];
  const screenId = await resolveWhatsAppFlowInitialScreenId({
    source: "external",
    flowId: "949758630803719",
    fetchExternalFirstScreenId: async (flowId) => {
      calls.push(flowId);
      return "BOAS_VINDAS";
    },
  });

  assert.deepEqual(calls, ["949758630803719"]);
  assert.equal(screenId, "BOAS_VINDAS");
});

test("prefers explicitly configured firstScreenId", async () => {
  const screenId = await resolveWhatsAppFlowInitialScreenId({
    source: "external",
    flowId: "949758630803719",
    firstScreenId: "DADOS_BASICOS",
    fetchExternalFirstScreenId: async () => {
      throw new Error("should not fetch when firstScreenId is set");
    },
  });

  assert.equal(screenId, "DADOS_BASICOS");
});
