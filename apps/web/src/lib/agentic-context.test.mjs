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

const { buildAgenticFlowVariableContext } = loadTypeScriptModule(
  "./agentic-context.ts"
);

test("keeps curated plan summary while hiding internal flow state", () => {
  const context = buildAgenticFlowVariableContext({
    objetivo: "Correr 5 km em 8 semanas",
    nivel: "iniciante",
    __agentic_loop_active_node_id: "agenticLoop-123",
    _training_plan: "raw plan should stay hidden",
    _coaching_summary: JSON.stringify({
      objetivo: "Completar 5 km sem dor",
      risco: "dor no joelho",
      foco_do_ciclo: "base aerobica",
      treino_chave_1: "2 km leve",
      treino_chave_2: "tiros curtos",
      longao: "4 km no sabado",
      principais_restricoes: ["joelho", "tempo curto"],
      criterio_para_subir_carga: "duas semanas sem dor",
      observacoes_importantes_para_o_coach: "evitar progressao agressiva",
      campo_nao_permitido: "nao deve aparecer",
    }),
  });

  assert.match(context, /- objetivo: Correr 5 km em 8 semanas/);
  assert.match(context, /- nivel: iniciante/);
  assert.match(context, /Resumo tecnico do plano entregue:/);
  assert.match(context, /- objetivo: Completar 5 km sem dor/);
  assert.match(context, /- risco: dor no joelho/);
  assert.match(context, /- principais restricoes: joelho; tempo curto/);
  assert.match(context, /- criterio para subir carga: duas semanas sem dor/);
  assert.doesNotMatch(context, /agenticLoop-123/);
  assert.doesNotMatch(context, /raw plan should stay hidden/);
  assert.doesNotMatch(context, /campo_nao_permitido/);
});

test("uses the curated summary even when no public variables exist", () => {
  const context = buildAgenticFlowVariableContext({
    _coaching_summary: JSON.stringify({
      foco_do_ciclo: "retomada conservadora",
    }),
  });

  assert.match(context, /Nenhuma variavel publica relevante/);
  assert.match(context, /Resumo tecnico do plano entregue:/);
  assert.match(context, /- foco do ciclo: retomada conservadora/);
});
