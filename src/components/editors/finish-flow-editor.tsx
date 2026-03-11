"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { FinishFlowNodeData } from "@/types/node-data";

interface FinishFlowEditorProps {
  nodeId: string;
  data: FinishFlowNodeData;
}

export function FinishFlowEditor({ nodeId, data }: FinishFlowEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<FinishFlowNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do no</Label>
        <Input
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-teal-200 bg-teal-50 p-3">
        <p className="text-xs font-medium text-teal-800">O que esse no faz</p>
        <p className="text-xs text-teal-700">
          Quando o flow chega aqui, a conversa sai da execucao e fica com status
          &quot;Finalizado&quot;.
        </p>
        <p className="text-xs text-teal-700">
          Novas mensagens ainda podem disparar outro flow ou voltar para a IA.
        </p>
      </div>
    </div>
  );
}
