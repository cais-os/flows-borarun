"use client";

import type { NodeProps } from "@xyflow/react";
import { Timer } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { WaitTimerNodeData } from "@/types/node-data";

const HANDLE_RESPONDED = "responded";
const HANDLE_NO_RESPONSE = "no_response";

export function WaitTimerNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WaitTimerNodeData;
  const config = NODE_CONFIG[NODE_TYPES.WAIT_TIMER];
  const minutes = nodeData.timeoutMinutes || 0;

  const sourceHandles = [
    { id: HANDLE_RESPONDED, label: "Respondeu", position: "65%" },
    { id: HANDLE_NO_RESPONSE, label: "Não respondeu", position: "85%" },
  ];

  const timeLabel =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ""}`
      : `${minutes}min`;

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Timer size={14} />}
      color={config.color}
      selected={selected}
      sourceHandles={sourceHandles}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Timer size={12} className="text-amber-500" />
          <span className="text-xs font-medium text-amber-700">
            Aguarda {minutes > 0 ? timeLabel : "..."}
          </span>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-[10px]">
            <span className="inline-block size-2 rounded-full bg-green-400" />
            <span className="text-gray-600">Respondeu → continua</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="inline-block size-2 rounded-full bg-red-400" />
            <span className="text-gray-600">Não respondeu → follow-up</span>
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
}
