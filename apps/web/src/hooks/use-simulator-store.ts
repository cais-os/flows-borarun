"use client";

import { create } from "zustand";
import type {
  Conversation,
  ChatMessage,
  SimulationStatus,
  ActiveTab,
} from "@/types/simulator";

interface SimulatorState {
  activeTab: ActiveTab;
  conversations: Conversation[];
  selectedConversationId: string | null;
  simulationStatus: SimulationStatus;
}

interface SimulatorActions {
  setActiveTab: (tab: ActiveTab) => void;
  addConversation: (conversation: Conversation) => void;
  setSelectedConversationId: (id: string | null) => void;
  setSimulationStatus: (status: SimulationStatus) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateConversationStatus: (
    conversationId: string,
    status: Conversation["status"]
  ) => void;
  setCurrentNode: (conversationId: string, nodeId: string | null) => void;
  setPendingNodeIds: (conversationId: string, nodeIds: string[]) => void;
  setFlowVariables: (
    conversationId: string,
    flowVariables: Record<string, string>
  ) => void;
  takeOverConversation: (conversationId: string) => void;
  returnToBot: (conversationId: string) => void;
  sendHumanMessage: (conversationId: string, text: string) => void;
  sendContactMessage: (conversationId: string, text: string) => void;
  resetSimulation: () => void;
}

export const useSimulatorStore = create<SimulatorState & SimulatorActions>(
  (set, get) => ({
    activeTab: "flows",
    conversations: [],
    selectedConversationId: null,
    simulationStatus: "idle",

    setActiveTab: (tab) => set({ activeTab: tab }),

    addConversation: (conversation) =>
      set((s) => ({
        conversations: [...s.conversations, conversation],
        selectedConversationId:
          s.selectedConversationId || conversation.id,
      })),

    setSelectedConversationId: (id) => set({ selectedConversationId: id }),

    setSimulationStatus: (status) => set({ simulationStatus: status }),

    addMessage: (conversationId, message) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message] }
            : c
        ),
      })),

    updateConversationStatus: (conversationId, status) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, status } : c
        ),
      })),

    setCurrentNode: (conversationId, nodeId) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, currentNodeId: nodeId } : c
        ),
      })),

    setPendingNodeIds: (conversationId, nodeIds) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, pendingNodeIds: nodeIds } : c
        ),
      })),

    setFlowVariables: (conversationId, flowVariables) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, flowVariables } : c
        ),
      })),

    takeOverConversation: (conversationId) => {
      const { addMessage } = get();
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, status: "human" } : c
        ),
      }));
      addMessage(conversationId, {
        id: `sys-${Date.now()}`,
        content: "Operador assumiu a conversa",
        type: "system",
        sender: "system",
        timestamp: new Date(),
      });
    },

    returnToBot: (conversationId) => {
      const { addMessage } = get();
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, status: "running" } : c
        ),
      }));
      addMessage(conversationId, {
        id: `sys-${Date.now()}`,
        content: "Bot retomou a conversa",
        type: "system",
        sender: "system",
        timestamp: new Date(),
      });
    },

    sendHumanMessage: (conversationId, text) => {
      const { addMessage } = get();
      addMessage(conversationId, {
        id: `human-${Date.now()}`,
        content: text,
        type: "text",
        sender: "human",
        timestamp: new Date(),
      });
    },

    sendContactMessage: (conversationId, text) => {
      const { addMessage } = get();
      addMessage(conversationId, {
        id: `contact-${Date.now()}`,
        content: text,
        type: "text",
        sender: "contact",
        timestamp: new Date(),
      });
    },

    resetSimulation: () =>
      set({
        conversations: [],
        selectedConversationId: null,
        simulationStatus: "idle",
      }),
  })
);
