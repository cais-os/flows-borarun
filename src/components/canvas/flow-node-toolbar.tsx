"use client";

import { type DragEvent } from "react";
import { Zap, MessageSquare, ImageIcon, Shuffle, MessageCircleQuestion, FileText } from "lucide-react";
import { NODE_TYPES } from "@/types/flow";
import { NODE_CONFIG } from "@/lib/constants";
import { getDefaultData } from "@/components/canvas/flow-canvas";
import { useFlowStore } from "@/hooks/use-flow-store";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const nodeItems = [
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
    type: NODE_TYPES.TEMPLATE_IMAGE,
    icon: <ImageIcon size={16} />,
    ...NODE_CONFIG[NODE_TYPES.TEMPLATE_IMAGE],
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
];

function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

export function FlowNodeToolbar() {
  const addNode = useFlowStore((s) => s.addNode);
  const nodes = useFlowStore((s) => s.nodes);

  const handleClick = (type: string) => {
    const maxY = nodes.length > 0
      ? Math.max(...nodes.map((n) => n.position.y)) + 120
      : 100;
    const centerX = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length
      : 250;

    addNode({
      id: `${type}-${Date.now()}`,
      type,
      position: { x: centerX, y: maxY },
      data: getDefaultData(type),
    });
  };

  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur">
      {nodeItems.map((item) => (
        <Tooltip key={item.type}>
          <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              onClick={() => handleClick(item.type)}
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
