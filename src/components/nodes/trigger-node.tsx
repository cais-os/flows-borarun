"use client";

import type { NodeProps } from "@xyflow/react";
import { Zap, UserPlus, Play } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { TriggerNodeData } from "@/types/node-data";

const triggerIcons = {
  keyword: <Zap size={14} />,
  newContact: <UserPlus size={14} />,
  manual: <Play size={14} />,
};

const triggerLabels = {
  keyword: "Palavra-chave",
  newContact: "Novo contato",
  manual: "Manual",
};

export function TriggerNode({ id, data, selected }: NodeProps) {
  const nodeData = data as TriggerNodeData;
  const config = NODE_CONFIG[NODE_TYPES.TRIGGER];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={triggerIcons[nodeData.triggerType] || <Zap size={14} />}
      color={config.color}
      showTargetHandle={false}
      selected={selected}
    >
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Tipo:</span>
        <span className="font-medium">
          {triggerLabels[nodeData.triggerType]}
        </span>
      </div>
      {nodeData.keyword && (
        <div className="mt-1 rounded bg-purple-50 px-1.5 py-0.5 text-purple-700 truncate">
          &quot;{nodeData.keyword}&quot;
        </div>
      )}
    </NodeWrapper>
  );
}
