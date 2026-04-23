"use client";

import type { NodeProps } from "@xyflow/react";
import { CreditCard } from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import { NODE_TYPES } from "@/types/flow";
import type { PaymentNodeData } from "@/types/node-data";

export function PaymentNode({ id, data, selected }: NodeProps) {
  const nodeData = data as PaymentNodeData;
  const config = NODE_CONFIG[NODE_TYPES.PAYMENT];

  const amount = nodeData.amount
    ? `R$ ${Number(nodeData.amount).toFixed(2)}`
    : "";
  const billingLabel =
    (nodeData.billingMode || "recurring") === "recurring"
      ? "Mensal recorrente"
      : "Avulso";

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={<CreditCard size={14} />}
      color={config.color}
      selected={selected}
    >
      <div className="space-y-1">
        {(nodeData.planName || amount) && (
          <div className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 text-xs">
            {nodeData.planName}
            {nodeData.planName && amount ? " · " : ""}
            {amount}
            {(nodeData.planName || amount) && billingLabel ? " · " : ""}
            {billingLabel}
          </div>
        )}
        <p className="text-gray-500 line-clamp-2 text-xs">
          {nodeData.messageText || "Envia link de pagamento Stripe"}
        </p>
      </div>
    </NodeWrapper>
  );
}
