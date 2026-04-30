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

const { isSubscriptionStatusQuestion } = loadTypeScriptModule(
  "./subscription-intent.ts"
);

test("does not treat payment-method questions as payment status checks", () => {
  assert.equal(isSubscriptionStatusQuestion("quero pagar no pix"), false);
  assert.equal(isSubscriptionStatusQuestion("quanto custa?"), false);
  assert.equal(isSubscriptionStatusQuestion("e isso aqui eu pago?"), false);
  assert.equal(isSubscriptionStatusQuestion("como faço para assinar?"), false);
});

test("treats confirmation questions and paid statements as payment status checks", () => {
  assert.equal(isSubscriptionStatusQuestion("meu pagamento caiu?"), true);
  assert.equal(isSubscriptionStatusQuestion("consegue verificar meu pix?"), true);
  assert.equal(isSubscriptionStatusQuestion("já paguei"), true);
  assert.equal(isSubscriptionStatusQuestion("minha assinatura premium está ativa?"), true);
});
