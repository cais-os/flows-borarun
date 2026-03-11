"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import {
  createDefaultWaitRoutes,
  createWaitForReplyRoute,
  ensureAnyRoutesLast,
  normalizeWaitForReplyNodeData,
} from "@/lib/wait-for-reply";
import type {
  WaitForReplyNodeData,
  WaitForReplyRoute,
} from "@/types/node-data";

interface WaitForReplyEditorProps {
  nodeId: string;
  data: WaitForReplyNodeData;
}

const MATCH_TYPE_LABELS = {
  contains: "Contem",
  exact: "Exato",
  startsWith: "Comeca com",
  any: "Qualquer resposta",
} as const;

export function WaitForReplyEditor({
  nodeId,
  data,
}: WaitForReplyEditorProps) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const normalized = normalizeWaitForReplyNodeData(data);

  const update = (partial: Partial<WaitForReplyNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const updateRoute = (
    routeId: string,
    partial: Partial<WaitForReplyRoute>
  ) => {
    const nextRoutes = ensureAnyRoutesLast(
      (normalized.routes || []).map((route) =>
        route.id === routeId ? { ...route, ...partial } : route
      )
    );

    update({ routes: nextRoutes });
  };

  const addSpecificRoute = () => {
    const routes = normalized.routes || createDefaultWaitRoutes();
    const anyRoutes = routes.filter((route) => route.matchType === "any");
    const specificRoutes = routes.filter((route) => route.matchType !== "any");

    update({
      routes: [
        ...specificRoutes,
        createWaitForReplyRoute("contains"),
        ...anyRoutes,
      ],
    });
  };

  const addFallbackRoute = () => {
    const routes = normalized.routes || [];
    if (routes.some((route) => route.matchType === "any")) return;
    update({
      routes: [...routes, createWaitForReplyRoute("any")],
    });
  };

  const removeRoute = (routeId: string) => {
    const routes = normalized.routes || [];
    const nextRoutes = routes.filter((route) => route.id !== routeId);
    const safeRoutes = nextRoutes.length > 0 ? nextRoutes : createDefaultWaitRoutes();
    update({ routes: ensureAnyRoutesLast(safeRoutes) });

    const store = useFlowStore.getState();
    const nextEdges = store.edges.filter(
      (edge) => !(edge.source === nodeId && edge.sourceHandle === routeId)
    );

    if (nextEdges.length !== store.edges.length) {
      useFlowStore.setState({ edges: nextEdges, isDirty: true });
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Nome do no</Label>
        <Input
          value={normalized.label}
          onChange={(event) => update({ label: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Mensagem antes de pausar (opcional)</Label>
        <Textarea
          value={normalized.promptMessage || ""}
          onChange={(event) => update({ promptMessage: event.target.value })}
          placeholder="Ex: Qual distancia voce quer correr?"
          rows={3}
        />
        <p className="text-xs text-gray-500">
          Se preenchida, essa mensagem sera enviada antes de o flow aguardar a
          resposta do usuario.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Nome da variavel</Label>
        <Input
          value={normalized.variableName || ""}
          onChange={(event) =>
            update({
              variableName: event.target.value.replace(/\s+/g, "_"),
            })
          }
          placeholder="Ex: objetivo, ritmo_atual, frequencia..."
        />
        <p className="text-xs text-gray-500">
          O valor salvo pode ser usado depois como{" "}
          <code className="rounded bg-gray-100 px-1">{"{{variavel}}"}</code>.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Descricao da variavel (opcional)</Label>
        <Input
          value={normalized.variableDescription || ""}
          onChange={(event) =>
            update({
              variableDescription: event.target.value,
            })
          }
          placeholder="Ex: Objetivo principal do corredor para os proximos 3 meses"
        />
        <p className="text-xs text-gray-500">
          Ajuda a identificar melhor o que essa resposta representa no flow.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Como salvar a resposta</Label>
        <select
          value={normalized.captureMode || "full"}
          onChange={(event) =>
            update({
              captureMode: event.target.value as WaitForReplyNodeData["captureMode"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
        >
          <option value="full">Resposta completa</option>
          <option value="summary">Resumo com IA</option>
        </select>
      </div>

      {normalized.captureMode === "summary" && (
        <div className="space-y-2">
          <Label>Instrucoes do resumo (opcional)</Label>
          <Textarea
            value={normalized.aiInstructions || ""}
            onChange={(event) => update({ aiInstructions: event.target.value })}
            placeholder="Ex: Resuma em uma frase curta focando meta, prazo e restricoes."
            rows={3}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Regras de saida</Label>
            <p className="mt-1 text-xs text-gray-500">
              As regras especificas sao avaliadas primeiro. A rota{" "}
              <code className="rounded bg-gray-100 px-1">qualquer resposta</code>{" "}
              funciona como fallback.
            </p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={addSpecificRoute}>
              <Plus size={14} className="mr-1" />
              Regra
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={addFallbackRoute}
              disabled={normalized.routes?.some((route) => route.matchType === "any")}
            >
              <Plus size={14} className="mr-1" />
              Fallback
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {(normalized.routes || []).map((route) => (
            <div key={route.id} className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={route.label}
                  onChange={(event) =>
                    updateRoute(route.id, { label: event.target.value })
                  }
                  placeholder={
                    route.matchType === "any"
                      ? "Qualquer resposta"
                      : "Ex: Usuario quer 5 km"
                  }
                  className="h-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRoute(route.id)}
                >
                  <Trash2 size={14} className="text-gray-400" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                <select
                  value={route.matchType}
                  onChange={(event) =>
                    updateRoute(route.id, {
                      matchType: event.target.value as WaitForReplyRoute["matchType"],
                      value:
                        event.target.value === "any" ? "" : route.value || "",
                      label:
                        event.target.value === "any"
                          ? "Qualquer resposta"
                          : route.label === "Qualquer resposta"
                            ? "Nova regra"
                            : route.label,
                    })
                  }
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                >
                  {Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {route.matchType === "any" ? (
                  <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    Essa rota recebe tudo que nao bater nas regras acima.
                  </div>
                ) : (
                  <Input
                    value={route.value || ""}
                    onChange={(event) =>
                      updateRoute(route.id, { value: event.target.value })
                    }
                    placeholder="Digite uma ou varias palavras, separadas por virgula"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mensagem se nenhuma regra bater (opcional)</Label>
        <Textarea
          value={normalized.noMatchMessage || ""}
          onChange={(event) => update({ noMatchMessage: event.target.value })}
          placeholder="Ex: Nao entendi. Pode responder usando uma das opcoes esperadas?"
          rows={3}
        />
        <p className="text-xs text-gray-500">
          So e usada quando nao houver match e nao existir rota de fallback.
        </p>
      </div>
    </div>
  );
}
