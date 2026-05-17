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
  DEFAULT_PAYMENT_CTA_BUTTON_TEXT,
  buildPaymentCtaBodyText,
  resolvePaymentCtaButtonText,
} = loadTypeScriptModule("./payment-message.ts");

test("defaults Stripe payment to the Assinar CTA button label", () => {
  assert.equal(DEFAULT_PAYMENT_CTA_BUTTON_TEXT, "Assinar");
  assert.equal(resolvePaymentCtaButtonText(undefined), "Assinar");
  assert.equal(resolvePaymentCtaButtonText("  "), "Assinar");
});

test("removes the payment link placeholder from Stripe CTA body text", () => {
  const bodyText = buildPaymentCtaBodyText({
    messageText:
      "Para assinar o plano, toque no botao abaixo:\n\n{{payment_link}}\n\nApos o pagamento, ativo seu acesso.",
    paymentUrl: "https://checkout.stripe.com/c/pay_123",
  });

  assert.equal(
    bodyText,
    "Para assinar o plano, toque no botao abaixo:\n\nApos o pagamento, ativo seu acesso."
  );
  assert.doesNotMatch(bodyText, /checkout\.stripe\.com/);
  assert.doesNotMatch(bodyText, /\{\{payment_link\}\}/);
});

test("builds a clean default Stripe CTA body without a plan name", () => {
  assert.equal(
    buildPaymentCtaBodyText({ paymentUrl: "https://checkout.stripe.com/c/pay_123" }),
    "Para assinar o plano, clique no botao abaixo:"
  );
});

test("falls back to the default Stripe CTA body when custom text only contains the link", () => {
  assert.equal(
    buildPaymentCtaBodyText({
      messageText: "{{payment_link}}",
      planName: "Premium",
      paymentUrl: "https://checkout.stripe.com/c/pay_123",
    }),
    "Para assinar o plano Premium, clique no botao abaixo:"
  );
});
