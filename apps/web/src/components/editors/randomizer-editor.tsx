"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { RandomizerNodeData, RandomizerSplit } from "@/types/node-data";

interface RandomizerEditorProps {
  nodeId: string;
  data: RandomizerNodeData;
}

export function RandomizerEditor({ nodeId, data }: RandomizerEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const edges = useFlowStore((s) => s.edges);

  const update = (partial: Partial<RandomizerNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const splits = data.splits;
  const total = splits.reduce((sum, s) => sum + s.percentage, 0);

  const updateSplit = (index: number, partial: Partial<RandomizerSplit>) => {
    const next = splits.map((s, i) =>
      i === index ? { ...s, ...partial } : s
    );
    update({ splits: next });
  };

  const addSplit = () => {
    if (splits.length >= 5) return;
    const letter = String.fromCharCode(65 + splits.length);
    const newSplit: RandomizerSplit = {
      id: `split-${letter.toLowerCase()}-${Date.now()}`,
      label: `Caminho ${letter}`,
      percentage: 0,
    };
    update({ splits: [...splits, newSplit] });
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    const removedId = splits[index].id;
    const next = splits.filter((_, i) => i !== index);
    update({ splits: next });

    // Remove orphaned edges
    const store = useFlowStore.getState();
    const nextEdges = store.edges.filter(
      (e) => !(e.source === nodeId && e.sourceHandle === removedId)
    );
    if (nextEdges.length !== store.edges.length) {
      useFlowStore.setState({ edges: nextEdges });
    }
  };

  const distributeEvenly = () => {
    const base = Math.floor(100 / splits.length);
    const remainder = 100 - base * splits.length;
    const next = splits.map((s, i) => ({
      ...s,
      percentage: base + (i < remainder ? 1 : 0),
    }));
    update({ splits: next });
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

      <div className="flex items-center justify-between">
        <Label>Caminhos ({splits.length})</Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={distributeEvenly}>
            <RotateCcw size={14} className="mr-1" />
            Igualar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addSplit}
            disabled={splits.length >= 5}
          >
            <Plus size={14} className="mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {splits.map((split, index) => (
          <div key={split.id} className="space-y-2 p-3 border rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <Input
                value={split.label}
                onChange={(e) =>
                  updateSplit(index, { label: e.target.value })
                }
                className="h-7 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSplit(index)}
                disabled={splits.length <= 2}
              >
                <Trash2 size={14} className="text-gray-400" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[split.percentage]}
                onValueChange={([v]) => updateSplit(index, { percentage: v })}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-mono w-10 text-right">
                {split.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {total !== 100 && (
        <p className="text-sm text-destructive">
          Total: {total}% (deve ser 100%)
        </p>
      )}
      {total === 100 && (
        <p className="text-sm text-green-600">Total: 100%</p>
      )}
    </div>
  );
}
