"use client";

import type { NodeProps } from "@xyflow/react";
import { ListChecks } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { WhatsAppFlowNodeData } from "@/types/node-data";

export function WhatsAppFlowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WhatsAppFlowNodeData;
  const config = NODE_CONFIG[NODE_TYPES.WHATSAPP_FLOW];

  const screenCount = nodeData.screens?.length || 0;
  const fieldCount =
    nodeData.screens?.reduce((sum, s) => sum + s.fields.length, 0) || 0;

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<ListChecks size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="space-y-1">
        {nodeData.externalFlowId && (
          <div className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 text-xs">
            Flow ID: {nodeData.externalFlowId.slice(0, 12)}...
          </div>
        )}
        {screenCount > 0 && (
          <div className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 text-xs">
            {screenCount} tela{screenCount > 1 ? "s" : ""} · {fieldCount} campo
            {fieldCount !== 1 ? "s" : ""}
          </div>
        )}
        <p className="text-gray-500 line-clamp-2 text-xs">
          {nodeData.bodyText || "Formulario nativo do WhatsApp"}
        </p>
      </div>
    </NodeWrapper>
  );
}
