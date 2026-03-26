"use client";

import { useCallback, useEffect, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Viewport,
  type Node,
  useReactFlow,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useFlowStore } from "@/hooks/use-flow-store";
import { NODE_TYPES } from "@/types/flow";
import { createDefaultSplits } from "@/lib/constants";
import { createDefaultWaitRoutes } from "@/lib/wait-for-reply";

import { TriggerNode } from "@/components/nodes/trigger-node";
import { SendMessageNode } from "@/components/nodes/send-message-node";
import { TagConversationNode } from "@/components/nodes/tag-conversation-node";
import { RandomizerNode } from "@/components/nodes/randomizer-node";
import { WaitForReplyNode } from "@/components/nodes/wait-for-reply-node";
import { GeneratePdfNode } from "@/components/nodes/generate-pdf-node";
import { WaitTimerNode } from "@/components/nodes/wait-timer-node";
import { FinishFlowNode } from "@/components/nodes/finish-flow-node";
import { AiCollectorNode } from "@/components/nodes/ai-collector-node";
import { StravaConnectNode } from "@/components/nodes/strava-connect-node";
import { PaymentNode } from "@/components/nodes/payment-node";
import { WhatsAppFlowNode } from "@/components/nodes/whatsapp-flow-node";

import type {
  TriggerNodeData,
  SendMessageNodeData,
  TagConversationNodeData,
  RandomizerNodeData,
  WaitForReplyNodeData,
  GeneratePdfNodeData,
  WaitTimerNodeData,
  FinishFlowNodeData,
  AiCollectorNodeData,
  StravaConnectNodeData,
  PaymentNodeData,
  WhatsAppFlowNodeData,
  NodeData,
} from "@/types/node-data";

const nodeTypes = {
  [NODE_TYPES.TRIGGER]: TriggerNode,
  [NODE_TYPES.SEND_MESSAGE]: SendMessageNode,
  [NODE_TYPES.TAG_CONVERSATION]: TagConversationNode,
  [NODE_TYPES.RANDOMIZER]: RandomizerNode,
  [NODE_TYPES.WAIT_FOR_REPLY]: WaitForReplyNode,
  [NODE_TYPES.GENERATE_PDF]: GeneratePdfNode,
  [NODE_TYPES.WAIT_TIMER]: WaitTimerNode,
  [NODE_TYPES.FINISH_FLOW]: FinishFlowNode,
  [NODE_TYPES.AI_COLLECTOR]: AiCollectorNode,
  [NODE_TYPES.STRAVA_CONNECT]: StravaConnectNode,
  [NODE_TYPES.PAYMENT]: PaymentNode,
  [NODE_TYPES.WHATSAPP_FLOW]: WhatsAppFlowNode,
};

export function createNodeId(type: string) {
  return `${type}-${Date.now()}`;
}

export function getDefaultData(type: string) {
  switch (type) {
    case NODE_TYPES.TRIGGER:
      return { type: "trigger", label: "Trigger", triggerType: "manual" } satisfies TriggerNodeData;
    case NODE_TYPES.SEND_MESSAGE:
      return {
        type: "sendMessage",
        label: "Enviar Mensagem",
        messageType: "text",
        interactiveType: "none",
      } satisfies SendMessageNodeData;
    case NODE_TYPES.TAG_CONVERSATION:
      return {
        type: "tagConversation",
        label: "Taguear",
        tagId: "",
      } satisfies TagConversationNodeData;
    case NODE_TYPES.RANDOMIZER:
      return { type: "randomizer", label: "Teste A/B", splits: createDefaultSplits() } satisfies RandomizerNodeData;
    case NODE_TYPES.WAIT_FOR_REPLY:
      return {
        type: "waitForReply",
        label: "Capturar Resposta",
        variableName: "",
        captureMode: "full",
        routes: createDefaultWaitRoutes(),
      } satisfies WaitForReplyNodeData;
    case NODE_TYPES.GENERATE_PDF:
      return { type: "generatePdf", label: "Gerar PDF", templateId: "" } satisfies GeneratePdfNodeData;
    case NODE_TYPES.WAIT_TIMER:
      return { type: "waitTimer", label: "Temporizador", timeoutMinutes: 45 } satisfies WaitTimerNodeData;
    case NODE_TYPES.FINISH_FLOW:
      return { type: "finishFlow", label: "Finalizar Flow" } satisfies FinishFlowNodeData;
    case NODE_TYPES.AI_COLLECTOR:
      return {
        type: "aiCollector",
        label: "Coletor IA",
        fields: [],
        initialPrompt: "",
        typingSeconds: 0,
        followUpTemplate: "Ainda preciso das seguintes informacoes: {{missing_fields}}. Pode me informar?",
        maxAttempts: 5,
      } satisfies AiCollectorNodeData;
    case NODE_TYPES.STRAVA_CONNECT:
      return {
        type: "stravaConnect",
        label: "Conectar Strava",
      } satisfies StravaConnectNodeData;
    case NODE_TYPES.PAYMENT:
      return {
        type: "payment",
        label: "Pagamento",
        planName: "",
        amount: 0,
        durationDays: 30,
      } satisfies PaymentNodeData;
    case NODE_TYPES.WHATSAPP_FLOW:
      return {
        type: "whatsappFlow",
        label: "Formulario WhatsApp",
        source: "external",
        bodyText: "",
        ctaText: "Abrir formulario",
        variablePrefix: "flow",
      } satisfies WhatsAppFlowNodeData;
    default:
      return {
        type: "sendMessage",
        label: "Enviar Mensagem",
        messageType: "text",
        interactiveType: "none",
      } satisfies SendMessageNodeData;
  }
}

// ---------------------------------------------------------------------------
// Viewport persistence per flow (localStorage)
// ---------------------------------------------------------------------------

const VIEWPORT_STORAGE_KEY = "borarun:flow-viewports";

function getSavedViewport(flowId: string): Viewport | null {
  try {
    const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (!stored) return null;
    const map = JSON.parse(stored) as Record<string, Viewport>;
    return map[flowId] || null;
  } catch {
    return null;
  }
}

function saveViewport(flowId: string, viewport: Viewport) {
  try {
    const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    const map = stored ? (JSON.parse(stored) as Record<string, Viewport>) : {};
    map[flowId] = viewport;
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Copy/paste for nodes
// ---------------------------------------------------------------------------

let copiedNodes: Node<NodeData>[] = [];

// ---------------------------------------------------------------------------

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { setViewport, fitView, getNodes, screenToFlowPosition } = useReactFlow();

  const flowId = useFlowStore((s) => s.flowId);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const addNode = useFlowStore((s) => s.addNode);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);

  // Restore viewport when flow changes
  useEffect(() => {
    if (!flowId) return;
    // Small delay to let nodes render first
    const timer = setTimeout(() => {
      const saved = getSavedViewport(flowId);
      if (saved) {
        setViewport(saved);
      } else {
        fitView({ padding: 0.28, maxZoom: 0.9 });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [flowId, setViewport, fitView]);

  // Copy/paste keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Ctrl+C — copy selected nodes
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const selected = getNodes().filter((n) => n.selected) as Node<NodeData>[];
        if (selected.length > 0) {
          copiedNodes = selected;
        }
      }

      // Ctrl+V — paste copied nodes
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && copiedNodes.length > 0) {
        e.preventDefault();
        const offset = 50;
        for (const node of copiedNodes) {
          const newNode: Node<NodeData> = {
            id: createNodeId(node.type || "sendMessage"),
            type: node.type,
            position: {
              x: node.position.x + offset,
              y: node.position.y + offset,
            },
            data: JSON.parse(JSON.stringify(node.data)) as NodeData,
          };
          addNode(newNode);
        }
        // Shift for next paste
        copiedNodes = copiedNodes.map((n) => ({
          ...n,
          position: { x: n.position.x + offset, y: n.position.y + offset },
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [getNodes, addNode]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: createNodeId(type),
        type,
        position,
        data: getDefaultData(type),
      };

      addNode(newNode);
    },
    [addNode, screenToFlowPosition]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={(_, viewport) => {
          if (flowId) saveViewport(flowId, viewport);
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
        fitViewOptions={{ padding: 0.28, maxZoom: 0.9 }}
        minZoom={0.35}
        maxZoom={1.3}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        selectionOnDrag
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-gray-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeStrokeWidth={3}
          className="!bg-white !border !border-gray-200 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
