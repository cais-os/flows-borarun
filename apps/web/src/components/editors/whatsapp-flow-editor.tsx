"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowStore } from "@/hooks/use-flow-store";
import type {
  WhatsAppFlowNodeData,
  WhatsAppFlowScreen,
  WhatsAppFlowField,
} from "@/types/node-data";

interface WhatsAppFlowEditorProps {
  nodeId: string;
  data: WhatsAppFlowNodeData;
}

const FIELD_TYPES = [
  { value: "TextInput", label: "Texto" },
  { value: "TextArea", label: "Texto longo" },
  { value: "Dropdown", label: "Dropdown" },
  { value: "RadioButtonsGroup", label: "Radio" },
  { value: "CheckboxGroup", label: "Checkbox" },
  { value: "DatePicker", label: "Data" },
  { value: "OptIn", label: "Aceite/Opt-in" },
] as const;

function createFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function createScreenId() {
  return `screen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function WhatsAppFlowEditor({ nodeId, data }: WhatsAppFlowEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<WhatsAppFlowNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const source = data.source || "external";
  const screens = data.screens || [];

  const addScreen = () => {
    update({
      screens: [
        ...screens,
        {
          id: createScreenId(),
          title: `Tela ${screens.length + 1}`,
          fields: [],
        },
      ],
    });
  };

  const updateScreen = (
    idx: number,
    partial: Partial<WhatsAppFlowScreen>
  ) => {
    const updated = screens.map((s, i) =>
      i === idx ? { ...s, ...partial } : s
    );
    update({ screens: updated });
  };

  const removeScreen = (idx: number) => {
    update({ screens: screens.filter((_, i) => i !== idx) });
  };

  const addField = (screenIdx: number) => {
    const screen = screens[screenIdx];
    if (!screen) return;
    const newField: WhatsAppFlowField = {
      id: createFieldId(),
      type: "TextInput",
      label: "",
      name: "",
      required: false,
    };
    updateScreen(screenIdx, { fields: [...screen.fields, newField] });
  };

  const updateField = (
    screenIdx: number,
    fieldIdx: number,
    partial: Partial<WhatsAppFlowField>
  ) => {
    const screen = screens[screenIdx];
    if (!screen) return;
    const fields = screen.fields.map((f, i) =>
      i === fieldIdx ? { ...f, ...partial } : f
    );
    updateScreen(screenIdx, { fields });
  };

  const removeField = (screenIdx: number, fieldIdx: number) => {
    const screen = screens[screenIdx];
    if (!screen) return;
    updateScreen(screenIdx, {
      fields: screen.fields.filter((_, i) => i !== fieldIdx),
    });
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
        <Label>Origem do Flow</Label>
        <Select
          value={source}
          onValueChange={(v) =>
            update({ source: v as "external" | "builder" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="external">Flow existente (ID externo)</SelectItem>
            <SelectItem value="builder">Criar via builder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {source === "external" && (
        <div className="space-y-2">
          <Label>Flow ID (Meta)</Label>
          <Input
            value={data.externalFlowId || ""}
            onChange={(e) => update({ externalFlowId: e.target.value })}
            placeholder="Ex: 123456789012345"
          />
          <p className="text-xs text-slate-400">
            ID do WhatsApp Flow criado no Meta Business Suite ou via API.
          </p>
        </div>
      )}

      {source === "builder" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Telas do formulario</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addScreen}
              className="h-7 gap-1 text-xs"
            >
              <Plus size={14} />
              Tela
            </Button>
          </div>

          {screens.length === 0 && (
            <p className="text-xs text-slate-400">
              Nenhuma tela adicionada. Clique em &quot;+ Tela&quot; para comecar.
            </p>
          )}

          {screens.map((screen, sIdx) => (
            <div
              key={screen.id}
              className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-slate-300" />
                <Input
                  value={screen.title}
                  onChange={(e) =>
                    updateScreen(sIdx, { title: e.target.value })
                  }
                  placeholder="Titulo da tela"
                  className="h-8 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeScreen(sIdx)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {screen.fields.map((field, fIdx) => (
                <div
                  key={field.id}
                  className="space-y-2 rounded border border-slate-200 bg-white p-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        updateField(sIdx, fIdx, {
                          label: e.target.value,
                          name: e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .replace(/[^a-z0-9_]/g, ""),
                        })
                      }
                      placeholder="Label do campo"
                      className="h-7 text-xs"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(v) =>
                        updateField(sIdx, fIdx, {
                          type: v as WhatsAppFlowField["type"],
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeField(sIdx, fIdx)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          updateField(sIdx, fIdx, {
                            required: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      Obrigatorio
                    </label>
                    <span className="text-xs text-slate-300">
                      var: {data.variablePrefix || "flow"}_{field.name || "..."}
                    </span>
                  </div>

                  {(field.type === "Dropdown" ||
                    field.type === "RadioButtonsGroup" ||
                    field.type === "CheckboxGroup") && (
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Opcoes (uma por linha)
                      </Label>
                      <Textarea
                        rows={3}
                        className="text-xs"
                        placeholder={"Opcao 1\nOpcao 2\nOpcao 3"}
                        value={
                          field.options
                            ?.map((o) => o.title)
                            .join("\n") || ""
                        }
                        onChange={(e) => {
                          const lines = e.target.value.split("\n");
                          updateField(sIdx, fIdx, {
                            options: lines.map((line, i) => ({
                              id: `${i}`,
                              title: line,
                            })),
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addField(sIdx)}
                className="h-7 w-full gap-1 text-xs text-slate-500"
              >
                <Plus size={12} />
                Campo
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label>Texto da mensagem</Label>
        <Textarea
          rows={3}
          value={data.bodyText || ""}
          onChange={(e) => update({ bodyText: e.target.value })}
          placeholder="Preencha o formulario abaixo:"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Texto do botao</Label>
          <Input
            value={data.ctaText || ""}
            onChange={(e) => update({ ctaText: e.target.value })}
            placeholder="Abrir formulario"
          />
        </div>
        <div className="space-y-2">
          <Label>Prefixo das variaveis</Label>
          <Input
            value={data.variablePrefix || ""}
            onChange={(e) => update({ variablePrefix: e.target.value })}
            placeholder="flow"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Header (opcional)</Label>
        <Input
          value={data.headerText || ""}
          onChange={(e) => update({ headerText: e.target.value })}
          placeholder="Formulario de cadastro"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={data.draftMode || false}
          onChange={(e) => update({ draftMode: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300"
        />
        Modo rascunho (para testes)
      </label>

      <div className="space-y-2 rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-medium text-emerald-800">
          O que esse no faz
        </p>
        <p className="text-xs text-emerald-700">
          Envia um formulario nativo do WhatsApp. O usuario preenche dentro do
          proprio app, sem sair do chat. As respostas sao salvas como variaveis
          do flow com o prefixo configurado.
        </p>
        <p className="text-xs text-emerald-700">
          Ex: prefixo <code className="text-emerald-900">lead</code> + campo{" "}
          <code className="text-emerald-900">nome</code> ={" "}
          <code className="text-emerald-900">{"{{lead_nome}}"}</code>
        </p>
      </div>
    </div>
  );
}
