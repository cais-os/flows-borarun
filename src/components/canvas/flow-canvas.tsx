"use client";

import { useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,

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
    default:
      return {
        type: "sendMessage",
        label: "Enviar Mensagem",
        messageType: "text",
        interactiveType: "none",
      } satisfies SendMessageNodeData;
  }
}

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactFlowInstance = useRef<any>(null);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const addNode = useFlowStore((s) => s.addNode);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
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
    [addNode]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 0.9 }}
        minZoom={0.35}
        maxZoom={1.3}
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
