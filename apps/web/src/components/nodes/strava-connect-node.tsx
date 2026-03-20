"use client";

import type { NodeProps } from "@xyflow/react";
import { Link } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { StravaConnectNodeData } from "@/types/node-data";

export function StravaConnectNode({ id, data, selected }: NodeProps) {
  const nodeData = data as StravaConnectNodeData;
  const config = NODE_CONFIG[NODE_TYPES.STRAVA_CONNECT];

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<Link size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="space-y-1">
        <div className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-700">
          Strava OAuth
        </div>
        <p className="text-gray-500 line-clamp-2">
          {nodeData.messageText || "Envia link para conectar o Strava"}
        </p>
      </div>
    </NodeWrapper>
  );
}
