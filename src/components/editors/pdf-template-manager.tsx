"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Code2,
  Loader2,
  Paintbrush,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfTemplatePreview } from "./pdf-template-preview";
import {
  applyPdfThemeToTemplate,
  DEFAULT_PDF_TEMPLATE_HTML,
  DEFAULT_PDF_TEMPLATE_THEME,
  PDF_FONT_OPTIONS,
  PDF_TEMPLATE_PRESETS,
  PDF_TEMPLATE_SAMPLE_AI_DATA,
  PDF_TEMPLATE_SAMPLE_FLOW_VARIABLES,
  readPdfThemeFromTemplate,
  type PdfTemplateTheme,
} from "@/lib/pdf-template-presets";
import { renderPdfTemplateHtml } from "@/lib/pdf-template-renderer";

type PdfTemplate = {
  id: string;
  name: string;
  html_content: string;
  created_at: string;
  updated_at: string;
};

interface PdfTemplateManagerProps {
  onClose: () => void;
  onTemplateCreated?: () => void;
}

export function PdfTemplateManager({
  onClose,
  onTemplateCreated,
}: PdfTemplateManagerProps) {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/pdf-templates");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedHtml = htmlContent.trim();
    if (!trimmedName || !trimmedHtml) return;

    setSaving(true);

    try {
      if (editingId) {
        const res = await fetch(`/api/pdf-templates/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            html_content: trimmedHtml,
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          setTemplates((prev) =>
            prev.map((template) =>
              template.id === editingId ? updated : template
            )
          );
        }
      } else {
        const res = await fetch("/api/pdf-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            html_content: trimmedHtml,
          }),
        });

        if (res.ok) {
          const created = await res.json();
          setTemplates((prev) =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
          );
        }
      }

      onTemplateCreated?.();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: PdfTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setHtmlContent(template.html_content);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);

    try {
      const res = await fetch(`/api/pdf-templates/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTemplates((prev) => prev.filter((template) => template.id !== id));
        if (editingId === id) resetForm();
        onTemplateCreated?.();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setHtmlContent("");
    setShowForm(false);
  };

  const startNew = () => {
    setEditingId(null);
    setName("Plano Bora Run");
    setHtmlContent(DEFAULT_PDF_TEMPLATE_HTML);
    setShowForm(true);
  };

  const currentTheme = readPdfThemeFromTemplate(
    htmlContent || DEFAULT_PDF_TEMPLATE_HTML
  );

  const previewHtml = renderPdfTemplateHtml({
    templateHtml: htmlContent || DEFAULT_PDF_TEMPLATE_HTML,
    flowVariables: PDF_TEMPLATE_SAMPLE_FLOW_VARIABLES,
    aiData: PDF_TEMPLATE_SAMPLE_AI_DATA,
  });

  const updateTheme = (partial: Partial<PdfTemplateTheme>) => {
    const nextTheme = {
      ...currentTheme,
      ...partial,
    };

    setHtmlContent((currentHtml) =>
      applyPdfThemeToTemplate(
        currentHtml || DEFAULT_PDF_TEMPLATE_HTML,
        nextTheme
      )
    );
  };

  const applyPreset = (presetHtml: string) => {
    setHtmlContent(applyPdfThemeToTemplate(presetHtml, currentTheme));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_120px_rgba(15,23,42,0.34)]">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Templates de PDF
            </h2>
            <p className="text-sm text-stone-500">
              Preview A4 ao vivo com presets e ajustes visuais.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={22} className="animate-spin text-stone-400" />
            </div>
          ) : !showForm ? (
            <div className="space-y-4 px-6 py-5">
              {templates.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-stone-700">
                    Nenhum template criado ainda
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    Comece por um preset pronto e ajuste o layout visualmente.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-3xl border border-stone-200 bg-[linear-gradient(180deg,#fffdf9_0%,#fff_100%)] p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-900">
                            {template.name}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            Atualizado em{" "}
                            {new Date(template.updated_at).toLocaleDateString(
                              "pt-BR"
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(template)}
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => void handleDelete(template.id)}
                            disabled={deletingId === template.id}
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                          >
                            {deletingId === template.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm text-stone-500">
                        {template.html_content
                          .replace(/<[^>]+>/g, " ")
                          .replace(/\s+/g, " ")
                          .trim()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-800">
                    Nome do template
                  </label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Plano Bora Run"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-800">
                        Estruturas prontas
                      </p>
                      <p className="text-xs text-stone-500">
                        Troca o layout inteiro e preserva o tema atual.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setHtmlContent(
                          applyPdfThemeToTemplate(
                            DEFAULT_PDF_TEMPLATE_HTML,
                            DEFAULT_PDF_TEMPLATE_THEME
                          )
                        )
                      }
                    >
                      <RefreshCcw size={14} />
                      Resetar base
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {PDF_TEMPLATE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset.html)}
                        className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-left transition hover:border-stone-300 hover:bg-stone-100"
                      >
                        <p className="text-sm font-semibold text-stone-900">
                          {preset.name}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <Tabs defaultValue="visual" className="gap-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="visual">
                      <Paintbrush size={14} />
                      Visual
                    </TabsTrigger>
                    <TabsTrigger value="code">
                      <Code2 size={14} />
                      HTML
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="visual" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">
                          Cor de destaque
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTheme.accentColor}
                            onChange={(event) =>
                              updateTheme({ accentColor: event.target.value })
                            }
                            className="h-10 w-14 rounded-xl border border-stone-300 bg-white"
                          />
                          <Input
                            value={currentTheme.accentColor}
                            onChange={(event) =>
                              updateTheme({ accentColor: event.target.value })
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">
                          Cor de superficie
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTheme.surfaceColor}
                            onChange={(event) =>
                              updateTheme({ surfaceColor: event.target.value })
                            }
                            className="h-10 w-14 rounded-xl border border-stone-300 bg-white"
                          />
                          <Input
                            value={currentTheme.surfaceColor}
                            onChange={(event) =>
                              updateTheme({ surfaceColor: event.target.value })
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">
                          Cor do texto
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTheme.textColor}
                            onChange={(event) =>
                              updateTheme({ textColor: event.target.value })
                            }
                            className="h-10 w-14 rounded-xl border border-stone-300 bg-white"
                          />
                          <Input
                            value={currentTheme.textColor}
                            onChange={(event) =>
                              updateTheme({ textColor: event.target.value })
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">
                          Cor secundaria
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTheme.mutedColor}
                            onChange={(event) =>
                              updateTheme({ mutedColor: event.target.value })
                            }
                            className="h-10 w-14 rounded-xl border border-stone-300 bg-white"
                          />
                          <Input
                            value={currentTheme.mutedColor}
                            onChange={(event) =>
                              updateTheme({ mutedColor: event.target.value })
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-stone-700">
                          Familia tipografica
                        </label>
                        <select
                          value={currentTheme.fontFamily}
                          onChange={(event) =>
                            updateTheme({ fontFamily: event.target.value })
                          }
                          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
                        >
                          {PDF_FONT_OPTIONS.map((fontOption) => (
                            <option
                              key={fontOption.value}
                              value={fontOption.value}
                            >
                              {fontOption.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium text-stone-700">
                          <label>Espacamento da pagina</label>
                          <span className="text-stone-500">
                            {currentTheme.pagePadding}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="64"
                          step="2"
                          value={currentTheme.pagePadding}
                          onChange={(event) =>
                            updateTheme({
                              pagePadding: Number(event.target.value),
                            })
                          }
                          className="w-full accent-orange-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium text-stone-700">
                          <label>Arredondamento</label>
                          <span className="text-stone-500">
                            {currentTheme.radius}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="32"
                          step="2"
                          value={currentTheme.radius}
                          onChange={(event) =>
                            updateTheme({
                              radius: Number(event.target.value),
                            })
                          }
                          className="w-full accent-orange-600"
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-orange-100 bg-orange-50 px-4 py-4 text-sm text-orange-950">
                      <p className="font-medium">
                        Os controles visuais editam as variaveis CSS do template.
                      </p>
                      <p className="mt-1 text-orange-900/80">
                        Para mudar a estrutura da pagina, troque o preset ou ajuste o HTML.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="code" className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">
                        HTML do template
                      </label>
                      <textarea
                        value={htmlContent}
                        onChange={(event) => setHtmlContent(event.target.value)}
                        placeholder="<html>...</html>"
                        rows={20}
                        className="min-h-[420px] w-full resize-y rounded-3xl border border-stone-300 bg-stone-950 px-4 py-4 font-mono text-xs leading-5 text-stone-100 outline-none focus:border-stone-500"
                        spellCheck={false}
                      />
                    </div>

                    <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                      <p className="font-medium text-stone-800">
                        Placeholders uteis
                      </p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <code className="rounded-xl bg-white px-3 py-2">
                          {"{{nome}}"}
                        </code>
                        <code className="rounded-xl bg-white px-3 py-2">
                          {"{{ai.aluno.resumo}}"}
                        </code>
                        <code className="rounded-xl bg-white px-3 py-2">
                          {"{{#each ai.semanas}} ... {{/each}}"}
                        </code>
                        <code className="rounded-xl bg-white px-3 py-2">
                          {"{{#each dias}} ... {{/each}}"}
                        </code>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-3">
                <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-sm font-semibold text-stone-900">
                    Preview A4
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Dados ficticios, mesma engine de placeholders do PDF final.
                  </p>
                </div>
                <PdfTemplatePreview
                  html={previewHtml}
                  dialogTitle="Preview A4 do template"
                  dialogDescription="Visualizacao ampliada do template com os dados ficticios usados no preview."
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-stone-200 px-6 py-4">
          {!showForm ? (
            <Button onClick={startNew} className="w-full">
              <Plus size={14} />
              Novo template
            </Button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={saving || !name.trim() || !htmlContent.trim()}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingId ? "Atualizar template" : "Criar template"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
