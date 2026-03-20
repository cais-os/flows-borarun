"use client";

import type { NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { FinishFlowNodeData } from "@/types/node-data";

export function FinishFlowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as FinishFlowNodeData;
  const config = NODE_CONFIG[NODE_TYPES.FINISH_FLOW];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Flag size={14} />}
      color={config.color}
      selected={selected}
      showSourceHandle={false}
    >
      <div className="space-y-1">
        <div className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-700">
          Status: Finalizado
        </div>
        <p className="text-gray-500">Encerra o flow imediatamente.</p>
      </div>
    </NodeWrapper>
  );
}
