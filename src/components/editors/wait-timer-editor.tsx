"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { WaitTimerNodeData } from "@/types/node-data";

interface WaitTimerEditorProps {
  nodeId: string;
  data: WaitTimerNodeData;
}

export function WaitTimerEditor({ nodeId, data }: WaitTimerEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<WaitTimerNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do nó</Label>
        <Input
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Tempo de espera (minutos)</Label>
        <Input
          type="number"
          min={1}
          max={10080}
          value={data.timeoutMinutes || ""}
          onChange={(e) =>
            update({ timeoutMinutes: Math.max(1, parseInt(e.target.value) || 1) })
          }
          placeholder="45"
        />
        <p className="text-xs text-gray-500">
          Se o usuario responder dentro desse tempo, o flow segue pela saida
          &quot;Respondeu&quot;. Caso contrário, segue por &quot;Não respondeu&quot;.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-medium text-amber-800">Como funciona</p>
        <ul className="space-y-1 text-xs text-amber-700">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 inline-block size-2 shrink-0 rounded-full bg-green-400" />
            <span>
              <strong>Respondeu</strong> — o usuario enviou qualquer mensagem
              antes do tempo esgotar
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 inline-block size-2 shrink-0 rounded-full bg-red-400" />
            <span>
              <strong>Não respondeu</strong> — o tempo esgotou sem resposta
              (ex: enviar lembrete, follow-up)
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
