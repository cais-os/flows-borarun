"use client";

import { type DragEvent } from "react";
import { Zap, MessageSquare, ImageIcon, Shuffle } from "lucide-react";
import { NODE_TYPES } from "@/types/flow";
import { NODE_CONFIG } from "@/lib/constants";
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
    type: NODE_TYPES.TEMPLATE_IMAGE,
    icon: <ImageIcon size={20} />,
    ...NODE_CONFIG[NODE_TYPES.TEMPLATE_IMAGE],
  },
  {
    type: NODE_TYPES.RANDOMIZER,
    icon: <Shuffle size={20} />,
    ...NODE_CONFIG[NODE_TYPES.RANDOMIZER],
  },
];

function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

export function FlowSidebar() {
  return (
    <aside className="w-14 border-r bg-white flex flex-col items-center py-3 gap-1 shrink-0">
      {nodeItems.map((item) => (
        <Tooltip key={item.type}>
          <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className="flex items-center justify-center w-10 h-10 rounded-lg cursor-grab active:cursor-grabbing transition-colors hover:bg-gray-100"
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
