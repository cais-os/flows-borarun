"use client";

import type { NodeProps } from "@xyflow/react";
import { FileText } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { GeneratePdfNodeData } from "@/types/node-data";

export function GeneratePdfNode({ id, data, selected }: NodeProps) {
  const nodeData = data as GeneratePdfNodeData;
  const config = NODE_CONFIG[NODE_TYPES.GENERATE_PDF];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<FileText size={14} />}
      color={config.color}
      selected={selected}
    >
      {nodeData.templateId ? (
        <div className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 truncate">
          {nodeData.fileName || "plano-de-treino.pdf"}
        </div>
      ) : (
        <p className="text-gray-400 italic">Clique para configurar</p>
      )}
    </NodeWrapper>
  );
}
