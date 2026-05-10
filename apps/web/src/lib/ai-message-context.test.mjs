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
  buildAiSendMessageChatMessages,
  resolveAiSendMessageHistorySettings,
} = loadTypeScriptModule("./ai-message-context.ts");

test("builds a plain AI send-message prompt without conversation history", () => {
  const messages = buildAiSendMessageChatMessages({
    prompt: "Valide o objetivo do usuario.",
    conversationHistory: [
      { role: "user", content: "Quero correr 10 km." },
    ],
    includeConversationHistory: false,
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.equal(messages[1].content, "Valide o objetivo do usuario.");
});

test("includes recent conversation history when the AI send-message node asks for it", () => {
  const messages = buildAiSendMessageChatMessages({
    prompt: "Valide o objetivo lendo a conversa.",
    conversationHistory: [
      { role: "assistant", content: "Qual e teu objetivo?" },
      { role: "user", content: "Quero perder peso e correr 5 km." },
    ],
    includeConversationHistory: true,
  });

  assert.equal(messages.length, 4);
  assert.equal(messages[1].content, "Qual e teu objetivo?");
  assert.equal(messages[2].content, "Quero perder peso e correr 5 km.");
  assert.equal(messages[3].content, "Valide o objetivo lendo a conversa.");
  assert.match(
    String(messages[0].content),
    /historico recente da conversa/i
  );
});

test("defaults free AI send-message nodes to include recent history", () => {
  assert.deepEqual(
    Object.entries(
      resolveAiSendMessageHistorySettings({
        variant: "freeAi",
      })
    ),
    [
      ["includeConversationHistory", true],
      ["historyWindowMessages", 20],
    ]
  );

  assert.deepEqual(
    Object.entries(
      resolveAiSendMessageHistorySettings({
        variant: "freeAi",
        includeConversationHistory: false,
        historyWindowMessages: 8,
      })
    ),
    [
      ["includeConversationHistory", false],
      ["historyWindowMessages", 8],
    ]
  );
});
