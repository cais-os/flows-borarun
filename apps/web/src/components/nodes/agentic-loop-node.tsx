"use client";

import type { NodeProps } from "@xyflow/react";
import { BrainCircuit } from "lucide-react";
import { NODE_CONFIG } from "@/lib/constants";
import type { AgenticLoopNodeData } from "@/types/node-data";
import { NODE_TYPES } from "@/types/flow";
import { NodeWrapper } from "./node-wrapper";

export function AgenticLoopNode({ id, data, selected }: NodeProps) {
  const nodeData = data as AgenticLoopNodeData;
  const config = NODE_CONFIG[NODE_TYPES.AGENTIC_LOOP];
  const handoffCount = nodeData.handoffTargets?.length ?? 0;

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<BrainCircuit size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
        modelo: {nodeData.model || "gpt-4o"}
      </div>
      <div className="mt-1 text-[10px] text-gray-500">
        {handoffCount} handoff{handoffCount !== 1 ? "s" : ""} | max{" "}
        {nodeData.maxTurns ?? 10} turnos
      </div>
    </NodeWrapper>
  );
}
