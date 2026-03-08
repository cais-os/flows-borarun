"use client";

import { useRef, useCallback } from "react";
import { Play, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSimulatorStore } from "@/hooks/use-simulator-store";
import { useFlowStore } from "@/hooks/use-flow-store";
import { runSimulation } from "@/lib/simulation-engine";
import type { Conversation } from "@/types/simulator";

const CONTACT_NAMES = [
  "Joao Silva",
  "Maria Santos",
  "Pedro Oliveira",
  "Ana Costa",
  "Lucas Ferreira",
  "Julia Souza",
  "Carlos Lima",
  "Fernanda Alves",
];

export function SimulationControls() {
  const conversations = useSimulatorStore((s) => s.conversations);
  const addConversation = useSimulatorStore((s) => s.addConversation);
  const addMessage = useSimulatorStore((s) => s.addMessage);
  const setCurrentNode = useSimulatorStore((s) => s.setCurrentNode);
  const setPendingNodeIds = useSimulatorStore((s) => s.setPendingNodeIds);
  const updateConversationStatus = useSimulatorStore(
    (s) => s.updateConversationStatus
  );
  const setSimulationStatus = useSimulatorStore(
    (s) => s.setSimulationStatus
  );
  const resetSimulation = useSimulatorStore((s) => s.resetSimulation);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  const stopRef = useRef(false);

  const startNewConversation = useCallback(async () => {
    const nameIndex = conversations.length % CONTACT_NAMES.length;
    const convId = `conv-${Date.now()}`;

    const conversation: Conversation = {
      id: convId,
      contactName: CONTACT_NAMES[nameIndex],
      contactPhone: `+55 11 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      messages: [],
      status: "running",
      currentNodeId: null,
      pendingNodeIds: [],
      flowVariables: {},
    };

    addConversation(conversation);
    setSimulationStatus("running");
    stopRef.current = false;

    await runSimulation(nodes, edges, {
      onMessage: (msg) => addMessage(convId, msg),
      onNodeChange: (nodeId) => setCurrentNode(convId, nodeId),
      onPause: ({ nodeId, pendingNodeIds }) => {
        setCurrentNode(convId, nodeId);
        setPendingNodeIds(convId, pendingNodeIds);
        updateConversationStatus(convId, "paused");
      },
      onComplete: () => {
        updateConversationStatus(convId, "completed");
        const store = useSimulatorStore.getState();
        const hasActive = store.conversations.some(
          (c) =>
            c.id !== convId &&
            (c.status === "running" || c.status === "paused")
        );
        if (!hasActive) setSimulationStatus("completed");
      },
      shouldStop: () => stopRef.current,
      getFlowVariables: () => {
        const store = useSimulatorStore.getState();
        return (
          store.conversations.find((conversation) => conversation.id === convId)
            ?.flowVariables || {}
        );
      },
      isHumanMode: () => {
        const store = useSimulatorStore.getState();
        const conv = store.conversations.find((c) => c.id === convId);
        return conv?.status === "human";
      },
    });
  }, [
    conversations.length,
    nodes,
    edges,
    addConversation,
    addMessage,
    setCurrentNode,
    setPendingNodeIds,
    updateConversationStatus,
    setSimulationStatus,
  ]);

  const handleReset = () => {
    stopRef.current = true;
    resetSimulation();
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b bg-white">
      <Button size="sm" className="gap-1.5" onClick={startNewConversation}>
        {conversations.length === 0 ? (
          <>
            <Play size={14} />
            Nova conversa
          </>
        ) : (
          <>
            <Plus size={14} />
            Nova conversa
          </>
        )}
      </Button>

      {conversations.length > 0 && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleReset}>
          <RotateCcw size={14} />
          Limpar
        </Button>
      )}

      {conversations.length > 0 && (
        <span className="text-xs text-gray-500 ml-auto">
          {conversations.length} conversa(s)
        </span>
      )}
    </div>
  );
}
