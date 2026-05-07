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

const { getRunningFlowWebhookAction } = loadTypeScriptModule(
  "./running-flow-guard.ts"
);

const now = new Date("2026-05-07T09:05:07.000Z");

function secondsAgo(seconds) {
  return new Date(now.getTime() - seconds * 1000).toISOString();
}

test("skips webhook processing for a fresh running flow even without checkpoint", () => {
  const action = getRunningFlowWebhookAction({
    status: "running",
    activeFlowId: "flow-1",
    currentNodeId: null,
    flowNodeQueue: [],
    updatedAt: secondsAgo(10),
    now,
  });

  assert.equal(action, "skip_processing");
});

test("continues a stale running flow when a checkpoint exists", () => {
  const action = getRunningFlowWebhookAction({
    status: "running",
    activeFlowId: "flow-1",
    currentNodeId: "aiCollector-1",
    flowNodeQueue: [],
    updatedAt: secondsAgo(180),
    now,
  });

  assert.equal(action, "continue_stale");
});

test("resets a stale running flow only when there is no checkpoint", () => {
  const action = getRunningFlowWebhookAction({
    status: "running",
    activeFlowId: "flow-1",
    currentNodeId: null,
    flowNodeQueue: [],
    updatedAt: secondsAgo(180),
    now,
  });

  assert.equal(action, "reset_stale");
});

test("ignores conversations that are not active running flows", () => {
  const action = getRunningFlowWebhookAction({
    status: "ai",
    activeFlowId: null,
    currentNodeId: null,
    flowNodeQueue: [],
    updatedAt: secondsAgo(10),
    now,
  });

  assert.equal(action, "ignore");
});
