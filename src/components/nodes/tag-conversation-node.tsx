"use client";

import type { NodeProps } from "@xyflow/react";
import { Tag } from "lucide-react";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { TagConversationNodeData } from "@/types/node-data";
import { NodeWrapper } from "./node-wrapper";

export function TagConversationNode({ id, data, selected }: NodeProps) {
  const nodeData = data as TagConversationNodeData;
  const config = NODE_CONFIG[NODE_TYPES.TAG_CONVERSATION];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Tag size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="space-y-1">
        {nodeData.tagName ? (
          <div className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
            Tag: {nodeData.tagName}
          </div>
        ) : (
          <p className="text-gray-400 italic">Selecione uma tag</p>
        )}
        <p className="text-gray-500">Adiciona a tag ao cliente e continua.</p>
      </div>
    </NodeWrapper>
  );
}
