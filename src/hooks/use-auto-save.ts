"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useFlowStore } from "./use-flow-store";
import type { Flow } from "@/types/flow";
import {
  deleteLocalFlow,
  normalizeFlow,
  upsertLocalFlow,
} from "@/lib/flow-persistence";

type SaveTarget = "local" | "remote" | null;
type SaveStatus = "idle" | "saving" | "saved" | "error";

type FlowSnapshot = {
  flowId: string;
  flowName: string;
  flowIsActive: boolean;
  nodes: ReturnType<typeof useFlowStore.getState>["nodes"];
  edges: ReturnType<typeof useFlowStore.getState>["edges"];
  isDirty: boolean;
};

function getFlowSnapshot(): FlowSnapshot {
  const state = useFlowStore.getState();

  return {
    flowId: state.flowId ?? "",
    flowName: state.flowName,
    flowIsActive: state.flowIsActive,
    nodes: state.nodes,
    edges: state.edges,
    isDirty: state.isDirty,
  };
}

export function useAutoSave() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flowId = useFlowStore((s) => s.flowId);
  const flowName = useFlowStore((s) => s.flowName);
  const flowIsActive = useFlowStore((s) => s.flowIsActive);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const isDirty = useFlowStore((s) => s.isDirty);
  const setClean = useFlowStore((s) => s.setClean);

  const persistSnapshot = useCallback(
    async (snapshot: FlowSnapshot, markClean = true): Promise<Flow | null> => {
      if (!snapshot.flowId || !snapshot.isDirty) return null;

      setSaveStatus("saving");
      setSaveError(null);
      setIsSaving(true);

      const localFlow = upsertLocalFlow(
        normalizeFlow({
          id: snapshot.flowId,
          name: snapshot.flowName,
          isActive: snapshot.flowIsActive,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          updated_at: new Date().toISOString(),
        })
      );

      if (snapshot.flowId.startsWith("local-")) {
        // Try to promote local flow to Supabase
        try {
          const promoteRes = await fetch("/api/flows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: snapshot.flowName,
              nodes: snapshot.nodes,
              edges: snapshot.edges,
              is_active: snapshot.flowIsActive,
            }),
          });

          if (promoteRes.ok) {
            const remoteFlow = normalizeFlow(
              (await promoteRes.json()) as Flow
            );
            // Remove old local entry and save with remote ID
            deleteLocalFlow(snapshot.flowId);
            upsertLocalFlow(remoteFlow);

            // Swap ID in the store if this flow is still active
            const store = useFlowStore.getState();
            if (store.flowId === snapshot.flowId) {
              store.setFlow(
                remoteFlow.id,
                remoteFlow.name,
                remoteFlow.nodes,
                remoteFlow.edges,
                remoteFlow.isActive
              );
            }

            if (markClean && useFlowStore.getState().flowId === remoteFlow.id) {
              setClean();
            }

            setLastSavedAt(remoteFlow.updated_at);
            setSaveTarget("remote");
            setSaveStatus("saved");
            setIsSaving(false);
            return remoteFlow;
          }
        } catch {
          // Promotion failed — fall through to local-only save
        }

        // Local-only fallback
        if (markClean && useFlowStore.getState().flowId === snapshot.flowId) {
          setClean();
        }

        setLastSavedAt(localFlow.updated_at);
        setSaveTarget("local");
        setSaveStatus("saved");
        setSaveError("Sem conexao com o servidor; salvo apenas no navegador.");
        setIsSaving(false);
        return localFlow;
      }

      try {
        const res = await fetch(`/api/flows/${snapshot.flowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: snapshot.flowName,
            is_active: snapshot.flowIsActive,
            nodes: snapshot.nodes,
            edges: snapshot.edges,
          }),
        });

        if (!res.ok) {
          if (markClean && useFlowStore.getState().flowId === snapshot.flowId) {
            setClean();
          }

          setLastSavedAt(localFlow.updated_at);
          setSaveTarget("local");
          setSaveStatus("saved");
          setSaveError("Falha no save remoto; mantido no navegador.");
          return localFlow;
        }

        const savedFlow = normalizeFlow((await res.json()) as Flow);
        upsertLocalFlow({
          ...savedFlow,
          isActive: snapshot.flowIsActive,
        });

        if (markClean && useFlowStore.getState().flowId === snapshot.flowId) {
          setClean();
        }

        setLastSavedAt(savedFlow.updated_at);
        setSaveTarget("remote");
        setSaveStatus("saved");
        return savedFlow;
      } catch (err) {
        console.error("Auto-save failed:", err);

        if (markClean && useFlowStore.getState().flowId === snapshot.flowId) {
          setClean();
        }

        setLastSavedAt(localFlow.updated_at);
        setSaveTarget("local");
        setSaveStatus("saved");
        setSaveError("Sem conexao com a API; salvo localmente.");
        return localFlow;
      } finally {
        setIsSaving(false);
      }
    },
    [setClean]
  );

  const save = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    return persistSnapshot(getFlowSnapshot());
  }, [persistSnapshot]);

  const flushPendingSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    return persistSnapshot(getFlowSnapshot());
  }, [persistSnapshot]);

  // Debounced auto-save
  useEffect(() => {
    if (!flowId) {
      setSaveStatus("idle");
      setSaveTarget(null);
      setSaveError(null);
      setLastSavedAt(null);
      return;
    }

    setSaveStatus("idle");
    setSaveTarget(flowId.startsWith("local-") ? "local" : null);
    setSaveError(null);
    setLastSavedAt(null);
  }, [flowId]);

  useEffect(() => {
    if (!flowId) return;

    if (!isDirty) return;

    const snapshot = getFlowSnapshot();

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void persistSnapshot(snapshot);
    }, 2000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [flowId, flowName, flowIsActive, nodes, edges, isDirty, persistSnapshot]);

  return {
    save,
    flushPendingSave,
    isSaving,
    saveStatus,
    saveTarget,
    saveError,
    lastSavedAt,
  };
}
