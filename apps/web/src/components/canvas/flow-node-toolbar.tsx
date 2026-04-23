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
  Bot,
  Link,
  CreditCard,
  ListChecks,
  Headphones,
  Sparkles,
  BrainCircuit,
} from "lucide-react";
import { NODE_TYPES } from "@/types/flow";
import { NODE_CONFIG } from "@/lib/constants";
import { getDefaultData } from "@/components/canvas/flow-canvas";
import { useFlowStore } from "@/hooks/use-flow-store";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { createNodeId } from "@/components/canvas/flow-canvas";

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
    icon: <Zap size={16} />,
    ...NODE_CONFIG[NODE_TYPES.TRIGGER],
  },
  {
    type: NODE_TYPES.SEND_MESSAGE,
    icon: <MessageSquare size={16} />,
    ...NODE_CONFIG[NODE_TYPES.SEND_MESSAGE],
  },
  {
    type: NODE_TYPES.SEND_MESSAGE,
    preset: "freeAi",
    icon: <Sparkles size={16} />,
    label: "IA Livre",
    color: "#8B5CF6",
    description: "Gera e envia uma resposta livre com IA",
  },
  {
    type: NODE_TYPES.TAG_CONVERSATION,
    icon: <Tag size={16} />,
    ...NODE_CONFIG[NODE_TYPES.TAG_CONVERSATION],
  },
  {
    type: NODE_TYPES.RANDOMIZER,
    icon: <Shuffle size={16} />,
    ...NODE_CONFIG[NODE_TYPES.RANDOMIZER],
  },
  {
    type: NODE_TYPES.WAIT_FOR_REPLY,
    icon: <MessageCircleQuestion size={16} />,
    ...NODE_CONFIG[NODE_TYPES.WAIT_FOR_REPLY],
  },
  {
    type: NODE_TYPES.GENERATE_PDF,
    icon: <FileText size={16} />,
    ...NODE_CONFIG[NODE_TYPES.GENERATE_PDF],
  },
  {
    type: NODE_TYPES.WAIT_TIMER,
    icon: <Timer size={16} />,
    ...NODE_CONFIG[NODE_TYPES.WAIT_TIMER],
  },
  {
    type: NODE_TYPES.FINISH_FLOW,
    icon: <Flag size={16} />,
    ...NODE_CONFIG[NODE_TYPES.FINISH_FLOW],
  },
  {
    type: NODE_TYPES.AI_COLLECTOR,
    icon: <Bot size={16} />,
    ...NODE_CONFIG[NODE_TYPES.AI_COLLECTOR],
  },
  {
    type: NODE_TYPES.STRAVA_CONNECT,
    icon: <Link size={16} />,
    ...NODE_CONFIG[NODE_TYPES.STRAVA_CONNECT],
  },
  {
    type: NODE_TYPES.PAYMENT,
    icon: <CreditCard size={16} />,
    ...NODE_CONFIG[NODE_TYPES.PAYMENT],
  },
  {
    type: NODE_TYPES.WHATSAPP_FLOW,
    icon: <ListChecks size={16} />,
    ...NODE_CONFIG[NODE_TYPES.WHATSAPP_FLOW],
  },
  {
    type: NODE_TYPES.WAIT_FOR_PLAYED,
    icon: <Headphones size={16} />,
    ...NODE_CONFIG[NODE_TYPES.WAIT_FOR_PLAYED],
  },
  {
    type: NODE_TYPES.AGENTIC_LOOP,
    icon: <BrainCircuit size={16} />,
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

export function FlowNodeToolbar() {
  const addNode = useFlowStore((s) => s.addNode);
  const nodes = useFlowStore((s) => s.nodes);

  const handleClick = (type: string, preset?: "freeAi") => {
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
    <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur">
      {nodeItems.map((item) => (
        <Tooltip key={`${item.type}:${item.preset ?? "default"}`}>
          <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, item.type, item.preset)}
              onClick={() => handleClick(item.type, item.preset)}
              className="flex items-center justify-center size-8 rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
              style={{ color: item.color }}
            >
              {item.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">{item.label}</p>
            <p className="text-xs opacity-70">{item.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
