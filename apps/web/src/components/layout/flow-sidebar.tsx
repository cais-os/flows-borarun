"use client";

import { type DragEvent, type ReactNode } from "react";
import {
  Zap,
  MessageSquare,
  Tag,
  Shuffle,
  MessageCircleQuestion,
  FileText,
  Timer,
  Flag,
  Link,
  Sparkles,
  BrainCircuit,
} from "lucide-react";
import { NODE_TYPES } from "@/types/flow";
import { NODE_CONFIG } from "@/lib/constants";
import { createNodeId, getDefaultData } from "@/components/canvas/flow-canvas";
import { useFlowStore } from "@/hooks/use-flow-store";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

type PaletteNodeItem = {
  type: string;
  preset?: "freeAi";
  icon: ReactNode;
  label: string;
  color: string;
  description: string;
};

const nodeItems: PaletteNodeItem[] = [
  {
    type: NODE_TYPES.TRIGGER,
    icon: <Zap size={20} />,
    ...NODE_CONFIG[NODE_TYPES.TRIGGER],
  },
  {
    type: NODE_TYPES.SEND_MESSAGE,
    icon: <MessageSquare size={20} />,
    ...NODE_CONFIG[NODE_TYPES.SEND_MESSAGE],
  },
  {
    type: NODE_TYPES.SEND_MESSAGE,
    preset: "freeAi",
    icon: <Sparkles size={20} />,
    label: "IA Livre",
    color: "#8B5CF6",
    description: "Gera e envia uma resposta livre com IA",
  },
  {
    type: NODE_TYPES.TAG_CONVERSATION,
    icon: <Tag size={20} />,
    ...NODE_CONFIG[NODE_TYPES.TAG_CONVERSATION],
  },
  {
    type: NODE_TYPES.RANDOMIZER,
    icon: <Shuffle size={20} />,
    ...NODE_CONFIG[NODE_TYPES.RANDOMIZER],
  },
  {
    type: NODE_TYPES.WAIT_FOR_REPLY,
    icon: <MessageCircleQuestion size={20} />,
    ...NODE_CONFIG[NODE_TYPES.WAIT_FOR_REPLY],
  },
  {
    type: NODE_TYPES.GENERATE_PDF,
    icon: <FileText size={20} />,
    ...NODE_CONFIG[NODE_TYPES.GENERATE_PDF],
  },
  {
    type: NODE_TYPES.WAIT_TIMER,
    icon: <Timer size={20} />,
    ...NODE_CONFIG[NODE_TYPES.WAIT_TIMER],
  },
  {
    type: NODE_TYPES.FINISH_FLOW,
    icon: <Flag size={20} />,
    ...NODE_CONFIG[NODE_TYPES.FINISH_FLOW],
  },
  {
    type: NODE_TYPES.STRAVA_CONNECT,
    icon: <Link size={20} />,
    ...NODE_CONFIG[NODE_TYPES.STRAVA_CONNECT],
  },
  {
    type: NODE_TYPES.AGENTIC_LOOP,
    icon: <BrainCircuit size={20} />,
    ...NODE_CONFIG[NODE_TYPES.AGENTIC_LOOP],
  },
];

function onDragStart(
  event: DragEvent,
  nodeType: string,
  preset?: "freeAi"
) {
  event.dataTransfer.setData(
    "application/reactflow",
    JSON.stringify({ type: nodeType, preset })
  );
  event.dataTransfer.effectAllowed = "move";
}

export function FlowSidebar() {
  const addNode = useFlowStore((s) => s.addNode);
  const nodes = useFlowStore((s) => s.nodes);

  const handleClick = (type: string, preset?: "freeAi") => {
    // Place new node below the lowest existing node
    const maxY = nodes.length > 0
      ? Math.max(...nodes.map((n) => n.position.y)) + 120
      : 100;
    const centerX = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length
      : 250;

    addNode({
      id: createNodeId(type),
      type,
      position: { x: centerX, y: maxY },
      data: getDefaultData(type, preset),
    });
  };

  return (
    <aside className="w-14 border-r bg-white flex flex-col items-center py-3 gap-1 shrink-0">
      {nodeItems.map((item) => (
        <Tooltip key={`${item.type}:${item.preset ?? "default"}`}>
          <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, item.type, item.preset)}
              onClick={() => handleClick(item.type, item.preset)}
              className="flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
              style={{ color: item.color }}
            >
              {item.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">{item.label}</p>
            <p className="text-xs opacity-70">{item.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </aside>
  );
}
