"use client";

import type { NodeProps } from "@xyflow/react";
import { Headphones } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { WaitForPlayedNodeData } from "@/types/node-data";

export function WaitForPlayedNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WaitForPlayedNodeData;
  const config = NODE_CONFIG[NODE_TYPES.WAIT_FOR_PLAYED];
  const minutes = nodeData.timeoutMinutes || 2;

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Headphones size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Headphones size={12} className="text-violet-500" />
          <span className="text-xs font-medium text-violet-700">
            Aguarda audio ser ouvido
          </span>
        </div>
        <div className="text-[10px] text-gray-500">
          Fallback: {minutes}min sem ouvir
        </div>
      </div>
    </NodeWrapper>
  );
}
