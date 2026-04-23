"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Brain,
  Clock3,
  CreditCard,
  FileText,
  Flag,
  GitBranch,
  Headphones,
  Link2,
  MessageSquare,
  PanelsTopLeft,
  Tag,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { NODE_CONFIG } from "@/lib/constants";
import type {
  FlowAnalyticsLayoutNode,
  FlowFunnelData,
} from "@/types/analytics";

const NODE_ICONS: Record<string, typeof Zap> = {
  trigger: Zap,
  sendMessage: MessageSquare,
  waitForReply: Clock3,
  randomizer: GitBranch,
  tagConversation: Tag,
  generatePdf: FileText,
  waitTimer: Timer,
  finishFlow: Flag,
  aiCollector: Brain,
  stravaConnect: Link2,
  payment: CreditCard,
  whatsappFlow: PanelsTopLeft,
  waitForPlayed: Headphones,
};

type AnalyticsNodeData = FlowAnalyticsLayoutNode;

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const safeHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const red = Number.parseInt(safeHex.slice(0, 2), 16);
  const green = Number.parseInt(safeHex.slice(2, 4), 16);
  const blue = Number.parseInt(safeHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getNodeConfig(nodeType: string) {
  if (nodeType in NODE_CONFIG) {
    return NODE_CONFIG[nodeType as keyof typeof NODE_CONFIG];
  }

  return {
    label: nodeType,
    color: "#64748B",
    description: "Etapa do flow",
  };
}

function AnalyticsFlowNode({ data }: NodeProps) {
  const nodeData = data as AnalyticsNodeData;
  const nodeConfig = getNodeConfig(nodeData.nodeType);
  const Icon = NODE_ICONS[nodeData.nodeType] || Zap;

  return (
    <div
      className="relative min-w-[230px] max-w-[230px] rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]"
      style={{
        background: `linear-gradient(180deg, ${hexToRgba(nodeConfig.color, 0.14)} 0%, rgba(255,255,255,0.98) 46%)`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-300 !opacity-0"
      />

      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: hexToRgba(nodeConfig.color, 0.16) }}
            >
              <Icon size={16} style={{ color: nodeConfig.color }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {nodeData.label}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {nodeConfig.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-slate-100 bg-white/90 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Users size={12} />
            Avancaram ate este no
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-800">
            {nodeData.visits}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-300 !opacity-0"
      />
    </div>
  );
}

const nodeTypes = {
  analyticsNode: AnalyticsFlowNode,
};

export function FlowAnalyticsMap({ funnel }: { funnel: FlowFunnelData }) {
  const nodeMetricsById = new Map(
    funnel.layoutNodes.map((node) => [node.nodeId, node])
  );

  const nodes: Node[] = funnel.layoutNodes.map((node) => ({
    id: node.nodeId,
    type: "analyticsNode",
    position: node.position,
    data: node,
    draggable: false,
    selectable: false,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const edges: Edge[] = funnel.layoutEdges.map((edge) => {
    const targetNode = nodeMetricsById.get(edge.target);
    const targetConfig = getNodeConfig(targetNode?.nodeType || "unknown");
    const opacity = targetNode?.visits ? 0.8 : 0.28;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      sourceHandle: null,
      style: {
        stroke: targetConfig.color,
        strokeWidth: 2.5,
        opacity,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: targetConfig.color,
      },
    };
  });

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Mapa do flow
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Mesmo layout do flow real, mostrando somente quantos usuarios
            avancaram ate cada no.
          </p>
        </div>
      </div>

      <div className="h-[620px] bg-[#f8fafc]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16, maxZoom: 1.1 }}
          minZoom={0.3}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          selectNodesOnDrag={false}
          zoomOnPinch
          panOnDrag
          className="bg-[#f8fafc]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color="#dbe3ee"
          />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            nodeStrokeWidth={3}
            nodeColor={(node) =>
              getNodeConfig(
                ((node.data as AnalyticsNodeData | undefined)?.nodeType as string) ||
                  "unknown"
              ).color
            }
            className="!rounded-2xl !border !border-slate-200 !bg-white"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
