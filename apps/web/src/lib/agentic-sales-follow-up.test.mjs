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
  AGENTIC_SALES_FOLLOW_UP_AFTER_HOURS,
  getAgenticSalesFollowUpDecision,
} = loadTypeScriptModule("./agentic-sales-follow-up.ts");

const now = new Date("2026-05-04T18:00:00.000Z");
const activeNodeId = "agenticLoop-pos-pdf-consultivo-natural-v3";

function hoursAgo(hours) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

test("sends a recovery follow-up after six hours of silence on a sales agent node", () => {
  const decision = getAgenticSalesFollowUpDecision({
    now,
    conversation: {
      current_node_id: activeNodeId,
      subscription_status: null,
      subscription_plan: null,
      flow_variables: {
        __agentic_loop_sales_mode: "true",
      },
    },
    messages: [
      {
        sender: "bot",
        node_id: activeNodeId,
        created_at: hoursAgo(AGENTIC_SALES_FOLLOW_UP_AFTER_HOURS + 0.1),
        metadata: null,
      },
    ],
  });

  assert.equal(decision.shouldSend, true);
  assert.equal(decision.nodeId, activeNodeId);
});

test("does not send when the user replied after the latest agent message", () => {
  const decision = getAgenticSalesFollowUpDecision({
    now,
    conversation: {
      current_node_id: activeNodeId,
      subscription_status: null,
      subscription_plan: null,
      flow_variables: {
        __agentic_loop_sales_mode: "true",
      },
    },
    messages: [
      {
        sender: "bot",
        node_id: activeNodeId,
        created_at: hoursAgo(7),
        metadata: null,
      },
      {
        sender: "contact",
        node_id: null,
        created_at: hoursAgo(5),
        metadata: null,
      },
    ],
  });

  assert.equal(decision.shouldSend, false);
});

test("does not send twice for the same latest agent message", () => {
  const latestAgentMessageAt = hoursAgo(7);
  const decision = getAgenticSalesFollowUpDecision({
    now,
    conversation: {
      current_node_id: activeNodeId,
      subscription_status: null,
      subscription_plan: null,
      flow_variables: {
        __agentic_loop_sales_mode: "true",
      },
    },
    messages: [
      {
        sender: "bot",
        node_id: activeNodeId,
        created_at: latestAgentMessageAt,
        metadata: null,
      },
      {
        sender: "bot",
        node_id: activeNodeId,
        created_at: hoursAgo(6.5),
        metadata: {
          agentic_sales_follow_up_kind: "post_pdf_agent_silence",
          agentic_sales_follow_up_for: latestAgentMessageAt,
        },
      },
    ],
  });

  assert.equal(decision.shouldSend, false);
});
