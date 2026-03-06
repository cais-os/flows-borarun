"use client";

import type { NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { TemplateImageNodeData } from "@/types/node-data";

export function TemplateImageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as TemplateImageNodeData;
  const config = NODE_CONFIG[NODE_TYPES.TEMPLATE_IMAGE];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<ImageIcon size={14} />}
      color={config.color}
      selected={selected}
    >
      {nodeData.headerImageUrl && (
        <div className="mb-1.5 overflow-hidden rounded">
          <img
            src={nodeData.headerImageUrl}
            alt="Header"
            className="h-12 w-full object-cover"
          />
        </div>
      )}

      {nodeData.templateName ? (
        <div className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 truncate">
          {nodeData.templateName}
        </div>
      ) : (
        <p className="text-gray-400 italic">Clique para configurar</p>
      )}

      {nodeData.bodyVariables &&
        Object.keys(nodeData.bodyVariables).length > 0 && (
          <div className="mt-1 text-[10px] text-gray-500">
            {Object.keys(nodeData.bodyVariables).length} variavel(is)
          </div>
        )}
    </NodeWrapper>
  );
}
