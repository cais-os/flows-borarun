"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import type {
  AgenticLoopHandoff,
  AgenticLoopNodeData,
} from "@/types/node-data";

interface AgenticLoopEditorProps {
  nodeId: string;
  data: AgenticLoopNodeData;
}

export function AgenticLoopEditor({
  nodeId,
  data,
}: AgenticLoopEditorProps) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  function patch(partial: Partial<AgenticLoopNodeData>) {
    updateNodeData(nodeId, partial);
  }

  function setHandoffs(next: AgenticLoopHandoff[]) {
    patch({ handoffTargets: next });
  }

  const handoffs = data.handoffTargets ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Nome do no</Label>
        <Input
          value={data.label ?? ""}
          onChange={(event) => patch({ label: event.target.value })}
          placeholder="Ex: Tirar duvidas sobre planos"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>System prompt</Label>
        <Textarea
          value={data.systemPrompt ?? ""}
          onChange={(event) => patch({ systemPrompt: event.target.value })}
          placeholder="Instrucoes para o modelo. Pode usar {{variaveis}} do flow."
          rows={6}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Modelo</Label>
          <Input
            value={data.model ?? "gpt-4o"}
            onChange={(event) => patch({ model: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Max turnos</Label>
          <Input
            type="number"
            min={1}
            value={data.maxTurns ?? 10}
            onChange={(event) =>
              patch({
                maxTurns: Math.max(1, Number(event.target.value) || 0),
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Historico (msgs)</Label>
          <Input
            type="number"
            min={1}
            value={data.historyWindowMessages ?? 20}
            onChange={(event) =>
              patch({
                historyWindowMessages: Math.max(
                  1,
                  Number(event.target.value) || 0
                ),
              })
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Handoffs</Label>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            onClick={() =>
              setHandoffs([
                ...handoffs,
                { nodeId: "", label: "", description: "" },
              ])
            }
          >
            <Plus size={12} /> Adicionar
          </Button>
        </div>

        {handoffs.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhum handoff. Adicione destinos que o modelo pode escolher para
            sair do loop.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {handoffs.map((handoff, index) => (
              <div
                key={`${handoff.nodeId}:${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={handoff.label}
                      onChange={(event) => {
                        const next = [...handoffs];
                        next[index] = {
                          ...handoff,
                          label: event.target.value,
                        };
                        setHandoffs(next);
                      }}
                      placeholder="label (ex: user_confirmed_purchase)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={handoff.nodeId}
                      onChange={(event) => {
                        const next = [...handoffs];
                        next[index] = {
                          ...handoff,
                          nodeId: event.target.value,
                        };
                        setHandoffs(next);
                      }}
                      placeholder="nodeId de destino"
                      className="h-8 text-xs"
                    />
                    <Textarea
                      value={handoff.description}
                      onChange={(event) => {
                        const next = [...handoffs];
                        next[index] = {
                          ...handoff,
                          description: event.target.value,
                        };
                        setHandoffs(next);
                      }}
                      placeholder="Quando o modelo deve escolher este handoff"
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setHandoffs(handoffs.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
