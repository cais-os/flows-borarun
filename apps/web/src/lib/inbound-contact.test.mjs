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

const { isFirstInboundFromContact } = loadTypeScriptModule(
  "./inbound-contact.ts"
);

test("treats a brand new conversation as first contact", () => {
  assert.equal(
    isFirstInboundFromContact({
      existingConversation: null,
      previousContactMessageCount: null,
    }),
    true
  );
});

test("treats an existing conversation with no prior contact messages as first contact", () => {
  assert.equal(
    isFirstInboundFromContact({
      existingConversation: { id: "conv-1" },
      previousContactMessageCount: 0,
    }),
    true
  );
});

test("does not treat an existing conversation with prior contact messages as first contact", () => {
  assert.equal(
    isFirstInboundFromContact({
      existingConversation: { id: "conv-1" },
      previousContactMessageCount: 1,
    }),
    false
  );
});

test("fails closed when prior contact message count is unknown", () => {
  assert.equal(
    isFirstInboundFromContact({
      existingConversation: { id: "conv-1" },
      previousContactMessageCount: null,
    }),
    false
  );
});
