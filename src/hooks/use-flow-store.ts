"use client";

import { create } from "zustand";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import { createDefaultSplits } from "@/lib/constants";
import type { NodeData } from "@/types/node-data";
import { normalizeWaitForReplyFlow } from "@/lib/wait-for-reply";

interface FlowState {
  flowId: string | null;
  flowName: string;
  flowIsActive: boolean;
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;
}

interface FlowActions {
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelectedNodeId: (id: string | null) => void;
  setFlow: (
    flowId: string,
    name: string,
    nodes: Node<NodeData>[],
    edges: Edge[],
    isActive?: boolean
  ) => void;
  clearFlow: () => void;
  addNode: (node: Node<NodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  setFlowName: (name: string) => void;
  setFlowActive: (isActive: boolean, markDirty?: boolean) => void;
  setClean: () => void;
}

function normalizeLoadedNodes(nodes: Node<NodeData>[]): Node<NodeData>[] {
  return nodes.map((node) => {
    if (node.data.type !== "randomizer") return node;

    const splits = node.data.splits;
    const isLegacyDefault =
      splits.length === 2 &&
      splits[0]?.id === "split-a" &&
      splits[0]?.label === "Caminho A" &&
      splits[0]?.percentage === 50 &&
      splits[1]?.id === "split-b" &&
      splits[1]?.label === "Caminho B" &&
      splits[1]?.percentage === 50;

    if (!isLegacyDefault) return node;

    return {
      ...node,
      data: {
        ...node.data,
        splits: createDefaultSplits(),
      },
    };
  });
}

function normalizeLoadedFlow(
  nodes: Node<NodeData>[],
  edges: Edge[]
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const normalizedNodes = normalizeLoadedNodes(nodes);
  const normalizedFlow = normalizeWaitForReplyFlow(normalizedNodes, edges);

  return {
    nodes: normalizedFlow.nodes as Node<NodeData>[],
    edges: normalizedFlow.edges as Edge[],
  };
}

export const useFlowStore = create<FlowState & FlowActions>((set, get) => ({
  flowId: null,
  flowName: "Novo Flow",
  flowIsActive: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<NodeData>[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
      isDirty: true,
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setFlow: (flowId, name, nodes, edges, isActive = false) => {
    const normalized = normalizeLoadedFlow(nodes, edges);

    set({
      flowId,
      flowName: name,
      flowIsActive: isActive,
      nodes: normalized.nodes,
      edges: normalized.edges,
      isDirty: false,
      selectedNodeId: null,
    });
  },

  clearFlow: () =>
    set({
      flowId: null,
      flowName: "Novo Flow",
      flowIsActive: false,
      nodes: [],
      edges: [],
      isDirty: false,
      selectedNodeId: null,
    }),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node], isDirty: true })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as NodeData }
          : node
      ),
      isDirty: true,
    })),

  deleteNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    })),

  setFlowName: (name) => set({ flowName: name, isDirty: true }),

  setFlowActive: (flowIsActive, markDirty = false) =>
    set((state) => ({
      flowIsActive,
      isDirty: markDirty ? true : state.isDirty,
    })),

  setClean: () => set({ isDirty: false }),
}));
