"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock3, Loader2, Plus, Power, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/hooks/use-flow-store";
import { cn } from "@/lib/utils";
import type { Flow } from "@/types/flow";
import {
  createLocalFlow,
  DEFAULT_FLOW_NAME,
  deleteLocalFlow,
  getFlowTriggerLabels,
  listLocalFlows,
  mergeFlowsWithLocalCache,
  normalizeFlow,
  upsertFlowInCollection,
  upsertLocalFlow,
} from "@/lib/flow-persistence";

interface FlowListPanelProps {
  onBeforeFlowChange?: () => Promise<unknown>;
  onOpenFlow?: () => void;
}

function formatUpdatedAt(updatedAt: string): string {
  const timestamp = new Date(updatedAt).getTime();
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "agora";
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))} min atras`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))} h atras`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(updatedAt));
}

export function FlowListPanel({
  onBeforeFlowChange,
  onOpenFlow,
}: FlowListPanelProps) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const flowId = useFlowStore((s) => s.flowId);
  const flowName = useFlowStore((s) => s.flowName);
  const flowIsActive = useFlowStore((s) => s.flowIsActive);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setFlow = useFlowStore((s) => s.setFlow);
  const clearFlow = useFlowStore((s) => s.clearFlow);
  const setFlowActive = useFlowStore((s) => s.setFlowActive);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch("/api/flows");
      if (!res.ok) {
        throw new Error("Unable to load flows");
      }

      const data = (await res.json()) as Flow[];
      const normalizedFlows = mergeFlowsWithLocalCache(
        data.map((flow) => normalizeFlow(flow))
      );
      const activeFlow = useFlowStore.getState();

      if (!activeFlow.flowId) {
        setFlows(normalizedFlows);
        return;
      }

      setFlows(
        upsertFlowInCollection(normalizedFlows, {
          id: activeFlow.flowId,
          name: activeFlow.flowName,
          isActive: activeFlow.flowIsActive,
          nodes: activeFlow.nodes,
          edges: activeFlow.edges,
          updated_at: new Date().toISOString(),
        })
      );
    } catch {
      setFlows(listLocalFlows());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFlows();
  }, [fetchFlows]);

  useEffect(() => {
    if (!flowId) return;

    const currentSnapshot = normalizeFlow({
      id: flowId,
      name: flowName,
      isActive: flowIsActive,
      nodes,
      edges,
      updated_at: new Date().toISOString(),
    });

    setFlows((prev) => {
      if (!prev.some((flow) => flow.id === flowId)) {
        return prev;
      }

      return upsertFlowInCollection(prev, currentSnapshot);
    });

    upsertLocalFlow(currentSnapshot);
  }, [edges, flowId, flowIsActive, flowName, nodes]);

  const createFlow = useCallback(async () => {
    setCreating(true);

    try {
      await onBeforeFlowChange?.();

      let nextFlow: Flow | null = null;

      try {
        const res = await fetch("/api/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: DEFAULT_FLOW_NAME, nodes: [], edges: [] }),
        });

        if (res.ok) {
          nextFlow = normalizeFlow((await res.json()) as Flow);
        }
      } catch {
        // network error
      }

      const createdFlow = nextFlow || createLocalFlow();
      upsertLocalFlow(createdFlow);
      setFlows((prev) => upsertFlowInCollection(prev, createdFlow));
      setFlow(
        createdFlow.id,
        createdFlow.name,
        createdFlow.nodes,
        createdFlow.edges,
        createdFlow.isActive
      );
      onOpenFlow?.();
    } finally {
      setCreating(false);
    }
  }, [onBeforeFlowChange, onOpenFlow, setFlow]);

  const deleteFlow = useCallback(
    async (id: string) => {
      const remainingFlows = flows.filter((flow) => flow.id !== id);
      setDeletingId(id);

      try {
        if (!id.startsWith("local-")) {
          const res = await fetch(`/api/flows/${id}`, { method: "DELETE" });
          if (!res.ok) {
            return;
          }
        }

        deleteLocalFlow(id);
        setFlows(remainingFlows);

        if (id === flowId) {
          clearFlow();
        }
      } finally {
        setDeletingId(null);
      }
    },
    [clearFlow, flowId, flows]
  );

  const selectFlow = useCallback(
    async (flow: Flow) => {
      if (flow.id === flowId) {
        onOpenFlow?.();
        return;
      }

      await onBeforeFlowChange?.();

      const latestFlow = flows.find((item) => item.id === flow.id) || flow;
      setFlow(
        latestFlow.id,
        latestFlow.name,
        latestFlow.nodes,
        latestFlow.edges,
        latestFlow.isActive
      );
      onOpenFlow?.();
    },
    [flowId, flows, onBeforeFlowChange, onOpenFlow, setFlow]
  );

  const toggleFlowActive = useCallback(
    async (flow: Flow) => {
      const updatedFlow = normalizeFlow({
        ...flow,
        isActive: !flow.isActive,
        updated_at: new Date().toISOString(),
      });

      upsertLocalFlow(updatedFlow);
      setFlows((prev) => upsertFlowInCollection(prev, updatedFlow));

      if (flow.id === flowId) {
        setFlowActive(updatedFlow.isActive ?? false, true);
      }

      // Persist to Supabase
      if (!flow.id.startsWith("local-")) {
        try {
          await fetch(`/api/flows/${flow.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: updatedFlow.name,
              is_active: updatedFlow.isActive,
              nodes: updatedFlow.nodes,
              edges: updatedFlow.edges,
            }),
          });
        } catch (err) {
          console.error("Failed to sync is_active:", err);
        }
      }
    },
    [flowId, setFlowActive]
  );

  const activeFlowsCount = flows.filter((flow) => flow.isActive).length;

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-200 bg-white/80 px-6 py-6 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              Flows
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Biblioteca de flows
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Escolha um flow para abrir o editor ou crie um novo. A lista fica
              separada do canvas para a navegacao ficar mais direta.
            </p>
          </div>

          <Button
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => void createFlow()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Novo flow
          </Button>
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-5xl flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white">
            {flows.length} flows
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            {activeFlowsCount} ativos
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            clique para abrir o editor
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-5xl">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : flows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                Nenhum flow ainda
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Crie o primeiro flow para montar sua automacao.
              </p>
              <Button
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => void createFlow()}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Criar flow
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {flows.map((flow) => {
                const isSelected = flowId === flow.id;
                const isDeleting = deletingId === flow.id;
                const triggerLabels = getFlowTriggerLabels(flow.nodes).slice(0, 2);

                return (
                  <div
                    key={flow.id}
                    onClick={() => void selectFlow(flow)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void selectFlow(flow);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "rounded-[20px] border bg-white px-4 py-3 text-left shadow-sm transition-all",
                      isSelected
                        ? "border-slate-900 ring-1 ring-slate-900/10"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Zap size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {flow.name}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              flow.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {flow.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{flow.nodes.length} nos</span>
                          <span>{flow.edges.length} conexoes</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={12} />
                            {formatUpdatedAt(flow.updated_at)}
                          </span>
                          {triggerLabels.length > 0 ? (
                            triggerLabels.map((label) => (
                              <span
                                key={`${flow.id}-${label}`}
                                className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700"
                              >
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                              Sem trigger
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFlowActive(flow);
                          }}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            flow.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-500"
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Power size={11} />
                            {flow.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteFlow(flow.id);
                          }}
                          disabled={isDeleting}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>

                        <div className="rounded-lg p-2 text-slate-400">
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
