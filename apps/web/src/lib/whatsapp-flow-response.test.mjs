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
  extractExternalWhatsAppFlowLeadVariables,
  shouldIgnoreExternalWhatsAppFlowReply,
} = loadTypeScriptModule("./whatsapp-flow-response.ts");

test("extracts lead name and email from Meta CTWA WhatsApp Flow fields", () => {
  const variables = extractExternalWhatsAppFlowLeadVariables({
    screen_0_Name_0: " Jose Alexandre ",
    screen_0_Email_1: "jose@example.com",
    flow_token: "token-123",
  });

  assert.equal(variables.lead_name, "Jose Alexandre");
  assert.equal(variables.lead_email, "jose@example.com");
  assert.equal(variables.__external_whatsapp_flow_response.includes("token-123"), false);
});

test("does not overwrite lead variables when no known lead fields are present", () => {
  const variables = extractExternalWhatsAppFlowLeadVariables({
    pergunta: "resposta",
    flow_token: "token-123",
  });

  assert.equal(Object.keys(variables).length, 0);
});

test("ignores external WhatsApp Flow replies while waiting on regular flow nodes", () => {
  assert.equal(
    shouldIgnoreExternalWhatsAppFlowReply({
      hasFlowResponseData: true,
      currentNodeType: "aiCollector",
      isNewContact: false,
    }),
    true
  );
});

test("does not ignore first-contact external WhatsApp Flow replies", () => {
  assert.equal(
    shouldIgnoreExternalWhatsAppFlowReply({
      hasFlowResponseData: true,
      currentNodeType: "",
      isNewContact: true,
    }),
    false
  );
});

test("keeps native WhatsApp Flow node replies resumable", () => {
  assert.equal(
    shouldIgnoreExternalWhatsAppFlowReply({
      hasFlowResponseData: true,
      currentNodeType: "whatsappFlow",
      isNewContact: false,
    }),
    false
  );
});
