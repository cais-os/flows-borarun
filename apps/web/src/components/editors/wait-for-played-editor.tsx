"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { WaitForPlayedNodeData } from "@/types/node-data";

interface WaitForPlayedEditorProps {
  nodeId: string;
  data: WaitForPlayedNodeData;
}

export function WaitForPlayedEditor({ nodeId, data }: WaitForPlayedEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<WaitForPlayedNodeData>) => {
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

      <div className="space-y-2">
        <Label>Timeout (minutos)</Label>
        <Input
          type="number"
          min={1}
          max={30}
          value={data.timeoutMinutes || 2}
          onChange={(e) =>
            update({ timeoutMinutes: Math.max(1, parseInt(e.target.value) || 2) })
          }
          placeholder="2"
        />
        <p className="text-xs text-gray-500">
          Se o usuario nao ouvir o audio dentro desse tempo, o flow segue automaticamente.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-violet-200 bg-violet-50 p-3">
        <p className="text-xs font-medium text-violet-800">Como funciona</p>
        <ul className="space-y-1 text-xs text-violet-700">
          <li>1. Coloque este no logo depois de um no que envia audio</li>
          <li>2. O flow pausa e aguarda o usuario ouvir o audio</li>
          <li>3. Quando o WhatsApp notificar que o audio foi ouvido, o flow continua</li>
          <li>4. Se o usuario enviar qualquer mensagem, tambem continua</li>
          <li>5. Se o timeout expirar, continua automaticamente</li>
        </ul>
      </div>
    </div>
  );
}
