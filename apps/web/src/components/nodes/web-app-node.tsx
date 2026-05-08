"use client";

import type { NodeProps } from "@xyflow/react";
import { Smartphone } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { WebAppNodeData } from "@/types/node-data";

export function WebAppNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WebAppNodeData;
  const config = NODE_CONFIG[NODE_TYPES.WEB_APP];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Smartphone size={14} />}
      color={config.color}
      selected={selected}
    >
      {nodeData.message?.trim() ? (
        <div className="truncate rounded bg-cyan-50 px-1.5 py-0.5 text-cyan-700">
          {nodeData.message}
        </div>
      ) : (
        <p className="text-gray-400 italic">Clique para configurar</p>
      )}
    </NodeWrapper>
  );
}
