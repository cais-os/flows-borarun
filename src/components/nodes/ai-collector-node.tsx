"use client";

import type { NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { AiCollectorNodeData } from "@/types/node-data";

export function AiCollectorNode({ id, data, selected }: NodeProps) {
  const nodeData = data as AiCollectorNodeData;
  const config = NODE_CONFIG[NODE_TYPES.AI_COLLECTOR];
  const fieldCount = nodeData.fields?.length || 0;
  const requiredCount = nodeData.fields?.filter((f) => f.required).length || 0;

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Bot size={14} />}
      color={config.color}
      selected={selected}
    >
      {fieldCount > 0 ? (
        <>
          <div className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 text-[10px]">
            {fieldCount} campo{fieldCount !== 1 ? "s" : ""} ({requiredCount} obrigatorio{requiredCount !== 1 ? "s" : ""})
          </div>
          <div className="mt-1 space-y-0.5">
            {nodeData.fields.slice(0, 4).map((field) => (
              <div
                key={field.id}
                className="truncate rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600"
              >
                {field.name}{field.required ? " *" : ""}
              </div>
            ))}
            {fieldCount > 4 && (
              <div className="text-[10px] text-gray-400 px-1.5">
                +{fieldCount - 4} mais...
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-400 italic">Clique para configurar</p>
      )}
      {nodeData.initialPrompt && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-gray-500 text-[10px]">
          {nodeData.initialPrompt}
        </p>
      )}
    </NodeWrapper>
  );
}
