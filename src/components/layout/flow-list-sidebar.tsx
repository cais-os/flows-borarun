"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Power, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/hooks/use-flow-store";
import { cn } from "@/lib/utils";
import type { Flow } from "@/types/flow";
import {
  createLocalFlow,
  DEFAULT_FLOW_NAME,
  deleteLocalFlow,
  listLocalFlows,
  mergeFlowsWithLocalCache,
  normalizeFlow,
  upsertFlowInCollection,
  upsertLocalFlow,
} from "@/lib/flow-persistence";

interface FlowListSidebarProps {
  onBeforeFlowChange?: () => Promise<unknown>;
}

function formatUpdatedAt(updatedAt: string): string {
  const timestamp = new Date(updatedAt).getTime();
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "agora";
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}min`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(updatedAt));
}

export function FlowListSidebar({ onBeforeFlowChange }: FlowListSidebarProps) {
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
      if (!res.ok) throw new Error("Unable to load flows");

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

  // Keep list in sync with store changes
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
      if (!prev.some((flow) => flow.id === flowId)) return prev;
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
    } finally {
      setCreating(false);
    }
  }, [onBeforeFlowChange, setFlow]);

  const deleteFlow = useCallback(
    async (id: string) => {
      const remainingFlows = flows.filter((flow) => flow.id !== id);
      setDeletingId(id);
      try {
        if (!id.startsWith("local-")) {
          const res = await fetch(`/api/flows/${id}`, { method: "DELETE" });
          if (!res.ok) return;
        }
        deleteLocalFlow(id);
        setFlows(remainingFlows);
        if (id === flowId) clearFlow();
      } finally {
        setDeletingId(null);
      }
    },
    [clearFlow, flowId, flows]
  );

  const selectFlow = useCallback(
    async (flow: Flow) => {
      if (flow.id === flowId) return;
      await onBeforeFlowChange?.();
      const latestFlow = flows.find((item) => item.id === flow.id) || flow;
      setFlow(
        latestFlow.id,
        latestFlow.name,
        latestFlow.nodes,
        latestFlow.edges,
        latestFlow.isActive
      );
    },
    [flowId, flows, onBeforeFlowChange, setFlow]
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

  return (
    <div className="flex h-full w-72 flex-col border-r bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Flows</h2>
          <p className="text-xs text-gray-400">{flows.length} flow(s)</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void createFlow()}
          disabled={creating}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Zap size={36} className="mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Nenhum flow criado</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => void createFlow()}
              disabled={creating}
            >
              <Plus size={14} className="mr-1" /> Novo flow
            </Button>
          </div>
        ) : (
          flows.map((flow) => {
            const isSelected = flowId === flow.id;
            const isDeleting = deletingId === flow.id;

            return (
              <button
                key={flow.id}
                onClick={() => void selectFlow(flow)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  isSelected ? "bg-blue-50" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {flow.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatUpdatedAt(flow.updated_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleFlowActive(flow);
                    }}
                    className={cn(
                      "rounded p-1 transition-colors",
                      flow.isActive
                        ? "text-green-600 hover:bg-green-50"
                        : "text-gray-400 hover:bg-gray-100"
                    )}
                  >
                    <Power size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteFlow(flow.id);
                    }}
                    disabled={isDeleting}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    {isDeleting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
