"use client";

import { type DragEvent } from "react";
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

const nodeItems = [
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
];

function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

export function FlowSidebar() {
  const addNode = useFlowStore((s) => s.addNode);
  const nodes = useFlowStore((s) => s.nodes);

  const handleClick = (type: string) => {
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
      data: getDefaultData(type),
    });
  };

  return (
    <aside className="w-14 border-r bg-white flex flex-col items-center py-3 gap-1 shrink-0">
      {nodeItems.map((item) => (
        <Tooltip key={item.type}>
          <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              onClick={() => handleClick(item.type)}
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
