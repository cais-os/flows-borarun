"use client";

import { useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { MessageCircleQuestion } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { WaitForReplyNodeData } from "@/types/node-data";
import {
  getWaitForReplySourceHandles,
  normalizeWaitForReplyNodeData,
} from "@/lib/wait-for-reply";

function getRouteHandlePositions(total: number): string[] {
  if (total <= 0) return [];
  if (total === 1) return ["80%"];

  const start = 72;
  const end = 90;
  const step = (end - start) / (total - 1);

  return Array.from({ length: total }, (_, index) => `${start + step * index}%`);
}

export function WaitForReplyNode({ id, data, selected }: NodeProps) {
  const nodeData = normalizeWaitForReplyNodeData(data as WaitForReplyNodeData);
  const config = NODE_CONFIG[NODE_TYPES.WAIT_FOR_REPLY];
  const updateNodeInternals = useUpdateNodeInternals();
  const routeHandlePositions = getRouteHandlePositions(
    (nodeData.routes || []).length
  );
  const sourceHandles = getWaitForReplySourceHandles(nodeData).map(
    (handle, index) => ({
      ...handle,
      position: routeHandlePositions[index],
    })
  );
  const handleSignature =
    sourceHandles.map((handle) => `${handle.id}:${handle.position}`).join("|") ||
    "default";

  useEffect(() => {
    updateNodeInternals(id);
  }, [handleSignature, id, updateNodeInternals]);

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<MessageCircleQuestion size={14} />}
      color={config.color}
      selected={selected}
      sourceHandles={sourceHandles}
    >
      {nodeData.variableName ? (
        <div className="rounded bg-pink-50 px-1.5 py-0.5 text-pink-700 truncate">
          {"{{" + nodeData.variableName + "}}"}
        </div>
      ) : (
        <p className="text-gray-400 italic">Clique para configurar</p>
      )}
      {nodeData.promptMessage && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-gray-700">
          {nodeData.promptMessage}
        </p>
      )}
      {nodeData.variableDescription && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[10px] text-pink-600">
          {nodeData.variableDescription}
        </p>
      )}
      <div className="mt-2 space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {nodeData.captureMode === "summary" ? "Resumo com IA" : "Resposta completa"}
        </p>
        <div className="space-y-1">
          {(nodeData.routes || []).map((route) => (
            <div
              key={route.id}
              className="truncate rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600"
            >
              {route.matchType === "any"
                ? route.label
                : `${route.label}: ${route.matchType} "${route.value}"`}
            </div>
          ))}
        </div>
      </div>
    </NodeWrapper>
  );
}
