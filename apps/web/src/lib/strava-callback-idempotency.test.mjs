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
  STRAVA_SUCCESS_MESSAGE,
  shouldSendStravaSuccessMessage,
} = loadTypeScriptModule("./strava-callback-idempotency.ts");

test("blocks duplicate Strava success messages in the recent window", () => {
  const now = Date.parse("2026-04-25T12:56:46.906Z");

  const shouldSend = shouldSendStravaSuccessMessage(
    [
      {
        content: STRAVA_SUCCESS_MESSAGE,
        sender: "bot",
        created_at: "2026-04-25T12:56:44.199Z",
      },
    ],
    now
  );

  assert.equal(shouldSend, false);
});

test("allows Strava success messages outside the recent window", () => {
  const now = Date.parse("2026-04-25T13:10:00.000Z");

  const shouldSend = shouldSendStravaSuccessMessage(
    [
      {
        content: STRAVA_SUCCESS_MESSAGE,
        sender: "bot",
        created_at: "2026-04-25T12:56:44.199Z",
      },
    ],
    now
  );

  assert.equal(shouldSend, true);
});
