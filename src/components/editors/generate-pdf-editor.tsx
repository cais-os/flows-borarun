"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/hooks/use-flow-store";
import { PdfTemplateManager } from "./pdf-template-manager";
import { PdfTemplatePreview } from "./pdf-template-preview";
import {
  PDF_TEMPLATE_SAMPLE_AI_DATA,
  PDF_TEMPLATE_SAMPLE_FLOW_VARIABLES,
} from "@/lib/pdf-template-presets";
import { renderPdfTemplateHtml } from "@/lib/pdf-template-renderer";
import type {
  GeneratePdfNodeData,
  WaitForReplyNodeData,
  AiCollectorNodeData,
} from "@/types/node-data";

type PdfTemplate = {
  id: string;
  name: string;
  html_content: string;
};

interface GeneratePdfEditorProps {
  nodeId: string;
  data: GeneratePdfNodeData;
}

export function GeneratePdfEditor({ nodeId, data }: GeneratePdfEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [showManager, setShowManager] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const availableVariables = Array.from(
    new Map(
      [
        ...nodes
          .filter((node) => node.data.type === "waitForReply")
          .map((node) => {
            const waitData = node.data as WaitForReplyNodeData;
            const variableName = waitData.variableName?.trim();
            if (!variableName) return null;

            return [
              variableName,
                    {
                      variableName,
                      sourceLabel: waitData.label || "Capturar Resposta",
                      description: waitData.variableDescription?.trim() || undefined,
                    },
                  ] as const;
          })
          .filter(Boolean) as Array<
          readonly [string, { variableName: string; sourceLabel: string }]
        >,
        ...nodes
          .filter((node) => node.data.type === "aiCollector")
          .flatMap((node) => {
            const collectorData = node.data as AiCollectorNodeData;
            return (collectorData.fields || [])
              .filter((f) => f.name?.trim())
              .map(
                (f) =>
                  [
                    f.name.trim(),
                    {
                      variableName: f.name.trim(),
                      sourceLabel: collectorData.label || "Coletor IA",
                      description: f.description?.trim() || undefined,
                    },
                  ] as const
              );
          }),
      ]
    ).values()
  );

  const fetchTemplates = useCallback(() => {
    fetch("/api/pdf-templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: PdfTemplate[]) => setTemplates(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const update = (partial: Partial<GeneratePdfNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const selectedTemplate = templates.find((template) => template.id === data.templateId);
  const previewHtml = selectedTemplate
    ? renderPdfTemplateHtml({
        templateHtml: selectedTemplate.html_content,
        flowVariables: PDF_TEMPLATE_SAMPLE_FLOW_VARIABLES,
        aiData: PDF_TEMPLATE_SAMPLE_AI_DATA,
      })
    : "";

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
        <div className="flex items-center justify-between">
          <Label>Template do PDF</Label>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs text-gray-500"
            onClick={() => setShowManager(true)}
          >
            <Settings size={12} />
            Gerenciar layout
          </Button>
        </div>
        <select
          value={data.templateId || ""}
          onChange={(e) => update({ templateId: e.target.value })}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
        >
          <option value="">Selecione um template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Preview do layout</Label>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Eye size={12} />
              clique para ampliar
            </span>
          </div>
          <PdfTemplatePreview
            html={previewHtml}
            className="max-w-[340px]"
            dialogTitle="Preview do layout do PDF"
            dialogDescription="Visualizacao ampliada com dados de exemplo para conferir a pagina inteira."
          />
          <p className="text-xs text-gray-500">
            Abra o gerenciador para trocar o preset, ajustar cores, espaco e editar o HTML.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Nome do arquivo</Label>
        <Input
          value={data.fileName || ""}
          onChange={(e) => update({ fileName: e.target.value })}
          placeholder="plano-de-treino.pdf"
        />
      </div>

      <div className="space-y-2">
        <Label>Prompt da IA (opcional)</Label>
        <Textarea
          ref={promptRef}
          value={data.aiPrompt || ""}
          onChange={(e) => update({ aiPrompt: e.target.value })}
          placeholder="Instruções customizadas para a IA gerar o plano..."
          rows={4}
        />
        <p className="text-xs text-gray-500">
          Se vazio, usa o prompt padrão de plano de treino de corrida. A IA
          recebe as respostas do flow e gera um JSON que é injetado no template.
        </p>

        <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">
              Variaveis capturadas no flow
            </Label>
            <p className="text-xs text-gray-500">
              Clique para inserir no prompt como{" "}
              <code className="rounded bg-white px-1">{"{{variavel}}"}</code>.
            </p>
          </div>

          {availableVariables.length === 0 ? (
            <p className="text-xs text-gray-400">
              Nenhuma variavel encontrada. Configure um no{" "}
              <span className="font-medium">Capturar Resposta</span> com
              nome de variavel.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableVariables.map((item) => (
                <button
                  key={item.variableName}
                  type="button"
                  onClick={() => {
                    const token = `{{${item.variableName}}}`;
                    const currentValue = data.aiPrompt || "";
                    const element = promptRef.current;

                    if (!element) {
                      update({
                        aiPrompt: currentValue
                          ? `${currentValue}${currentValue.endsWith(" ") ? "" : " "}${token}`
                          : token,
                      });
                      return;
                    }

                    const start = element.selectionStart ?? currentValue.length;
                    const end = element.selectionEnd ?? currentValue.length;
                    const nextValue =
                      currentValue.slice(0, start) + token + currentValue.slice(end);
                    const nextCursor = start + token.length;

                    update({ aiPrompt: nextValue });

                    requestAnimationFrame(() => {
                      element.focus();
                      element.setSelectionRange(nextCursor, nextCursor);
                    });
                  }}
                  className="rounded-full border border-pink-200 bg-white px-2.5 py-1 text-xs font-medium text-pink-700 transition hover:border-pink-300 hover:bg-pink-50"
                  title={`Inserir ${item.variableName} (${item.sourceLabel})`}
                >
                  {`{{${item.variableName}}}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showManager && (
        <PdfTemplateManager
          onClose={() => setShowManager(false)}
          onTemplateCreated={fetchTemplates}
        />
      )}
    </div>
  );
}
