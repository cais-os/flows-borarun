"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Send,
  Save,
  Loader2,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "@/hooks/use-campaigns";

interface MetaTemplate {
  name: string;
  id: string;
  language: string;
  status: string;
  category: string;
  components: Array<{
    type: string;
    text?: string;
    example?: { body_text?: string[][] };
  }>;
}

interface CampanhasEditorProps {
  campaign: Campaign;
  onUpdate: (id: string, updates: Partial<Campaign>) => Promise<Campaign | null>;
  onSend: (id: string) => Promise<{ sent: number; failed: number } | null>;
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

function extractTemplateVariables(template: MetaTemplate): string[] {
  const bodyComponent = template.components.find((c) => c.type === "BODY");
  if (!bodyComponent?.text) return [];
  const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
  return matches ? matches.map((_, i) => `{{${i + 1}}}`) : [];
}

export function CampanhasEditor({ campaign, onUpdate, onSend }: CampanhasEditorProps) {
  const [name, setName] = useState(campaign.name);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    campaign.template_name || ""
  );
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([]);
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);

  const isReadOnly = campaign.status !== "draft";

  useEffect(() => {
    setName(campaign.name);
    setSelectedTemplate(campaign.template_name || "");
    if (campaign.scheduled_at) {
      setSendMode("scheduled");
      // Convert ISO to datetime-local format
      const dt = new Date(campaign.scheduled_at);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setScheduledAt(local);
    }
    if (campaign.recipients.length > 0) {
      const firstRecipient = campaign.recipients[0];
      const cols = ["phone", "name", ...Object.keys(firstRecipient.variables || {})];
      setCsvColumns([...new Set(cols)]);
      setCsvData(
        campaign.recipients.map((r) => ({
          phone: r.phone,
          name: r.name || "",
          ...r.variables,
        }))
      );
    }
  }, [campaign]);

  useEffect(() => {
    fetch("/api/meta/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});
  }, []);

  const handleCSVUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) return;
        const cols = Object.keys(rows[0]);
        setCsvColumns(cols);
        setCsvData(rows);
      };
      reader.readAsText(file);
    },
    []
  );

  const currentTemplate = templates.find((t) => t.name === selectedTemplate);
  const templateVars = currentTemplate ? extractTemplateVariables(currentTemplate) : [];

  const handleSave = async () => {
    setSaving(true);
    const recipients = csvData
      .filter((row) => row.phone || row.Phone || row.telefone)
      .map((row) => {
        const phone = row.phone || row.Phone || row.telefone || "";
        const recipientName = row.name || row.Name || row.nome || "";
        const variables: Record<string, string> = {};
        for (const [varName, colName] of Object.entries(variableMapping)) {
          variables[varName] = row[colName] || "";
        }
        return { phone, name: recipientName, variables };
      });

    await onUpdate(campaign.id, {
      name,
      template_name: selectedTemplate || null,
      template_id: currentTemplate?.id || null,
      template_language: currentTemplate?.language || "pt_BR",
      body_variables: templateVars.map(
        (v) => variableMapping[v] || v
      ),
      recipients,
      scheduled_at:
        sendMode === "scheduled" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
    });
    setSaving(false);
  };

  const handleSend = async () => {
    await handleSave();
    setSending(true);
    const result = await onSend(campaign.id);
    setSending(false);
    if (result) setSendResult(result);
  };

  const handleSchedule = async () => {
    if (!scheduledAt) return;
    setSaving(true);
    const recipients = csvData
      .filter((row) => row.phone || row.Phone || row.telefone)
      .map((row) => {
        const phone = row.phone || row.Phone || row.telefone || "";
        const recipientName = row.name || row.Name || row.nome || "";
        const variables: Record<string, string> = {};
        for (const [varName, colName] of Object.entries(variableMapping)) {
          variables[varName] = row[colName] || "";
        }
        return { phone, name: recipientName, variables };
      });

    await onUpdate(campaign.id, {
      name,
      template_name: selectedTemplate || null,
      template_id: currentTemplate?.id || null,
      template_language: currentTemplate?.language || "pt_BR",
      body_variables: templateVars.map((v) => variableMapping[v] || v),
      recipients,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "scheduled",
    });
    setSaving(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-white">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {isReadOnly ? campaign.name : "Editar campanha"}
          </h2>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Save size={14} className="mr-1" />
                )}
                Salvar
              </Button>
              {sendMode === "now" ? (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sending || csvData.length === 0 || !selectedTemplate}
                >
                  {sending ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Send size={14} className="mr-1" />
                  )}
                  Enviar agora
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleSchedule()}
                  disabled={saving || csvData.length === 0 || !selectedTemplate || !scheduledAt}
                >
                  {saving ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Calendar size={14} className="mr-1" />
                  )}
                  Agendar envio
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {sendResult && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 size={18} className="text-green-600" />
          <span className="text-sm text-green-700">
            Disparo finalizado: {sendResult.sent} enviados, {sendResult.failed} falhas
          </span>
          <button
            onClick={() => setSendResult(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isReadOnly ? (
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Template</p>
            <p className="font-medium">{campaign.template_name || "—"}</p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Destinatarios</p>
            <p className="font-medium">{campaign.total_recipients} contato(s)</p>
          </div>
          {campaign.status === "scheduled" && campaign.scheduled_at && (
            <div className="rounded-lg border bg-blue-50 p-4">
              <p className="text-sm text-gray-500">Agendada para</p>
              <p className="font-medium">
                {new Date(campaign.scheduled_at).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
          {campaign.status === "sent" && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Resultado</p>
              <p className="font-medium">
                {campaign.sent_count} enviados, {campaign.failed_count} falhas
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 px-6 py-6">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome da campanha</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Promo Dezembro"
            />
          </div>

          {/* CSV Upload */}
          <div className="space-y-2">
            <Label>Base de contatos (CSV)</Label>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50">
                <Upload size={16} />
                {csvData.length > 0
                  ? `${csvData.length} contatos carregados`
                  : "Selecionar arquivo CSV"}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
              </label>
              {csvData.length > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <FileSpreadsheet size={12} className="mr-1" />
                  {csvColumns.length} colunas
                </Badge>
              )}
            </div>
            {csvData.length > 0 && (
              <div className="mt-2 max-h-40 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      {csvColumns.map((col) => (
                        <th
                          key={col}
                          className="border-b px-3 py-2 text-left font-medium text-gray-600"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {csvColumns.map((col) => (
                          <td key={col} className="px-3 py-1.5 text-gray-700">
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 5 && (
                  <p className="px-3 py-1.5 text-xs text-gray-400">
                    + {csvData.length - 5} mais...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template do WhatsApp</Label>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-400">
                Carregando templates... (verifique as credenciais Meta)
              </p>
            ) : (
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Selecione um template</option>
                {templates
                  .filter((t) => t.status === "APPROVED")
                  .map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
              </select>
            )}

            {currentTemplate && (
              <div className="mt-2 rounded border bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Preview</p>
                <p className="mt-1 text-sm text-gray-700">
                  {currentTemplate.components.find((c) => c.type === "BODY")?.text ||
                    "Sem texto"}
                </p>
              </div>
            )}
          </div>

          {/* Variable Mapping */}
          {templateVars.length > 0 && csvColumns.length > 0 && (
            <div className="space-y-2">
              <Label>Mapeamento de variaveis</Label>
              <p className="text-xs text-gray-400">
                Associe cada variavel do template a uma coluna do CSV
              </p>
              <div className="space-y-2">
                {templateVars.map((varName) => (
                  <div key={varName} className="flex items-center gap-3">
                    <Badge variant="outline" className="shrink-0">
                      {varName}
                    </Badge>
                    <select
                      value={variableMapping[varName] || ""}
                      onChange={(e) =>
                        setVariableMapping((prev) => ({
                          ...prev,
                          [varName]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione coluna</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send Mode */}
          <div className="space-y-3">
            <Label>Quando enviar</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSendMode("now")}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  sendMode === "now"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Send size={14} />
                Enviar agora
              </button>
              <button
                type="button"
                onClick={() => setSendMode("scheduled")}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  sendMode === "scheduled"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Clock size={14} />
                Agendar
              </button>
            </div>
            {sendMode === "scheduled" && (
              <div className="space-y-2">
                <Label>Data e hora do envio</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
