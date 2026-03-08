"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { TriggerNodeData } from "@/types/node-data";

interface TriggerEditorProps {
  nodeId: string;
  data: TriggerNodeData;
}

export function TriggerEditor({ nodeId, data }: TriggerEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<TriggerNodeData>) => {
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
        <Label>Tipo de trigger</Label>
        <Select
          value={data.triggerType}
          onValueChange={(v) =>
            update({
              triggerType: v as TriggerNodeData["triggerType"],
              keyword: undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keyword">Palavra-chave</SelectItem>
            <SelectItem value="newContact">Novo contato</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.triggerType === "keyword" && (
        <>
          <div className="space-y-2">
            <Label>Correspondencia</Label>
            <Select
              value={data.keywordMatch || "contains"}
              onValueChange={(v) =>
                update({
                  keywordMatch: v as TriggerNodeData["keywordMatch"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contem</SelectItem>
                <SelectItem value="notContains">Nao contem</SelectItem>
                <SelectItem value="exact">Exatamente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Palavra-chave</Label>
            <Input
              value={data.keyword || ""}
              onChange={(e) => update({ keyword: e.target.value })}
              placeholder="Ex: oi, promo, oferta..."
            />
          </div>
        </>
      )}
    </div>
  );
}
