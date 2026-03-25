"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { AiCollectorNodeData, AiCollectorField } from "@/types/node-data";

interface AiCollectorEditorProps {
  nodeId: string;
  data: AiCollectorNodeData;
}

function createField(): AiCollectorField {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    required: true,
  };
}

export function AiCollectorEditor({ nodeId, data }: AiCollectorEditorProps) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const update = (partial: Partial<AiCollectorNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const fields = data.fields || [];

  const updateField = (fieldId: string, partial: Partial<AiCollectorField>) => {
    update({
      fields: fields.map((f) => (f.id === fieldId ? { ...f, ...partial } : f)),
    });
  };

  const addField = () => {
    update({ fields: [...fields, createField()] });
  };

  const removeField = (fieldId: string) => {
    update({ fields: fields.filter((f) => f.id !== fieldId) });
  };

  return (
    <div className="space-y-6">
      {/* Label */}
      <div className="space-y-1.5">
        <Label>Nome do no</Label>
        <Input
          value={data.label || ""}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="Coletor IA"
        />
      </div>

      {/* Initial prompt */}
      <div className="space-y-1.5">
        <Label>Mensagem inicial</Label>
        <Textarea
          value={data.initialPrompt || ""}
          onChange={(e) => update({ initialPrompt: e.target.value })}
          placeholder="Oi! Me manda um audio ou texto com suas informacoes: nome, idade, peso, altura e experiencia com corrida."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Primeira mensagem enviada ao usuario pedindo as informacoes. Suporta {"{{variaveis}}"}.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Segundos escrevendo</Label>
        <Input
          type="number"
          min={0}
          max={30}
          value={data.typingSeconds ?? 0}
          onChange={(e) =>
            update({
              typingSeconds: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
            })
          }
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">
          Tempo do indicador &quot;digitando...&quot; antes da mensagem inicial. Maximo 30s.
        </p>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Campos a coletar</Label>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus size={14} className="mr-1" />
            Adicionar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          O nome da variavel e usado para armazenar o dado coletado. Para onboarding de corrida, use o prefixo <strong>onb_</strong> (ex: onb_idade, onb_peso, onb_objetivo) para manter compatibilidade com o gerador de plano e o coach IA.
        </p>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Nenhum campo configurado. Adicione os campos que deseja coletar.
          </p>
        )}

        {fields.map((field) => (
          <div
            key={field.id}
            className="rounded-md border p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={field.name}
                  onChange={(e) =>
                    updateField(field.id, { name: e.target.value })
                  }
                  placeholder="Nome da variavel (ex: onb_idade)"
                  className="text-sm"
                />
                <Input
                  value={field.description}
                  onChange={(e) =>
                    updateField(field.id, { description: e.target.value })
                  }
                  placeholder="Descricao para a IA (ex: Idade do corredor em anos)"
                  className="text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeField(field.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  updateField(field.id, { required: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-xs text-muted-foreground">
                Obrigatorio
              </span>
            </label>
          </div>
        ))}
      </div>

      {/* Follow-up template */}
      <div className="space-y-1.5">
        <Label>Mensagem de follow-up</Label>
        <Textarea
          value={
            data.followUpTemplate ||
            "Ainda preciso das seguintes informacoes: {{missing_fields}}. Pode me informar?"
          }
          onChange={(e) => update({ followUpTemplate: e.target.value })}
          placeholder="Ainda preciso das seguintes informacoes: {{missing_fields}}. Pode me informar?"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Enviada quando faltam campos. Use {"{{missing_fields}}"} e {"{{collected_summary}}"}.
        </p>
      </div>

      {/* Completion message */}
      <div className="space-y-1.5">
        <Label>Mensagem ao completar (opcional)</Label>
        <Textarea
          value={data.completionMessage || ""}
          onChange={(e) => update({ completionMessage: e.target.value })}
          placeholder="Obrigado! Recebi todas as informacoes. Gerando seu plano..."
          rows={2}
        />
      </div>

      {/* Max attempts */}
      <div className="space-y-1.5">
        <Label>Maximo de tentativas</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={data.maxAttempts || 5}
          onChange={(e) =>
            update({ maxAttempts: Math.max(1, parseInt(e.target.value) || 5) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Apos atingir o limite, continua o flow com os campos coletados ate o momento.
        </p>
      </div>

      {/* AI extraction prompt */}
      <div className="space-y-1.5">
        <Label>Instrucoes extras para IA (opcional)</Label>
        <Textarea
          value={data.aiExtractionPrompt || ""}
          onChange={(e) => update({ aiExtractionPrompt: e.target.value })}
          placeholder="Ex: Se o usuario mencionar que nunca correu, marque experiencia como 'iniciante'"
          rows={3}
        />
      </div>
    </div>
  );
}
