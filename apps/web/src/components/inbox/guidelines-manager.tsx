"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Building2, Loader2, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEFAULT_PROMPT = `Você é o treinador de corrida virtual da BoraRun. Seu nome é Coach BoraRun.

Suas diretrizes:
- Você é especialista em corrida de rua, trail running, maratonas, meias-maratonas e corrida para iniciantes
- Responda sempre em português brasileiro, de forma motivadora e acolhedora
- Use uma linguagem acessível, como se estivesse falando com um amigo corredor
- Dê conselhos baseados em evidências sobre treino, nutrição para corredores, prevenção de lesões, alongamento e recuperação
- Ajude a montar planilhas de treino personalizadas quando solicitado
- Pergunte sobre o nível do corredor (iniciante, intermediário, avançado), objetivos e histórico de lesões antes de prescrever treinos
- Mantenha respostas concisas (ideal para WhatsApp) — use no máximo 3-4 parágrafos curtos
- Use emojis com moderação para manter o tom amigável (🏃‍♂️, 💪, ✅, etc)
- Nunca dê diagnósticos médicos — sempre recomende procurar um profissional de saúde quando necessário
- Lembre-se do contexto da conversa para dar respostas coerentes

REGRA IMPORTANTE sobre assuntos fora do tema:
- Se o usuário falar sobre algo que NÃO seja relacionado a corrida, exercício físico, saúde esportiva ou a BoraRun, responda brevemente com contexto e redirecione de forma natural e simpática para o universo da corrida
- Exemplo: se perguntar sobre futebol, diga algo como "Futebol é legal demais! Mas aqui minha especialidade é corrida 🏃‍♂️ Que tal a gente focar no seu treino? Me conta: você já corre ou quer começar?"
- Nunca ignore a pessoa — sempre acolha o que ela disse antes de redirecionar
- Se ela insistir em assuntos fora do tema, seja gentil mas firme: "Entendo! Mas como treinador de corrida, posso te ajudar melhor com treinos, metas de corrida e dicas pra evoluir. Bora lá?"`;

const GUIDELINE_KEY = "ai_coach";
const COMPANY_KEY = "company_info";

type GuidelinesData = {
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
};

type Tab = "coach" | "empresa";

interface GuidelinesManagerProps {
  onClose: () => void;
}

export function GuidelinesManager({ onClose }: GuidelinesManagerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("coach");

  // Coach state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);

  // Company state
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySite, setCompanySite] = useState("");
  const [companyInstagram, setCompanyInstagram] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyExtra, setCompanyExtra] = useState("");

  const fetchGuidelines = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-guidelines?key=${GUIDELINE_KEY}`);
      if (res.ok) {
        const data: GuidelinesData | null = await res.json();
        if (data?.system_prompt) {
          setSystemPrompt(data.system_prompt);
          setModel(data.model || "gpt-4o-mini");
          setTemperature(data.temperature ?? 0.7);
          setMaxTokens(data.max_tokens ?? 500);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-guidelines?key=${COMPANY_KEY}`);
      if (res.ok) {
        const data: { system_prompt?: string } | null = await res.json();
        if (data?.system_prompt) {
          try {
            const parsed = JSON.parse(data.system_prompt);
            setCompanyName(parsed.name || "");
            setCompanySite(parsed.site || "");
            setCompanyInstagram(parsed.instagram || "");
            setCompanyPhone(parsed.phone || "");
            setCompanyEmail(parsed.email || "");
            setCompanyDescription(parsed.description || "");
            setCompanyExtra(parsed.extra || "");
          } catch {
            // legacy plain text
            setCompanyDescription(data.system_prompt);
          }
        }
      }
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGuidelines();
    void fetchCompanyInfo();
  }, [fetchGuidelines, fetchCompanyInfo]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/ai-guidelines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: GUIDELINE_KEY,
          system_prompt: systemPrompt,
          model,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setCompanySaving(true);
    setCompanySaved(false);
    try {
      const payload = JSON.stringify({
        name: companyName,
        site: companySite,
        instagram: companyInstagram,
        phone: companyPhone,
        email: companyEmail,
        description: companyDescription,
        extra: companyExtra,
      });
      const res = await fetch("/api/ai-guidelines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: COMPANY_KEY,
          system_prompt: payload,
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      if (res.ok) {
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 2000);
      }
    } finally {
      setCompanySaving(false);
    }
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_PROMPT);
    setModel("gpt-4o-mini");
    setTemperature(0.7);
    setMaxTokens(500);
  };

  const isSaving = activeTab === "coach" ? saving : companySaving;
  const isSaved = activeTab === "coach" ? saved : companySaved;
  const isLoading = activeTab === "coach" ? loading : companyLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Guia da IA</h2>
            <p className="text-xs text-gray-400">
              Configure o comportamento da IA e informacoes da empresa
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          <button
            type="button"
            onClick={() => setActiveTab("coach")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === "coach"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            <Bot size={14} />
            IA Coach
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("empresa")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === "empresa"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            <Building2 size={14} />
            Empresa
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : activeTab === "coach" ? (
            <>
              {/* System Prompt */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-gray-400 font-mono"
                  placeholder="Escreva o prompt do sistema que define a personalidade e regras da IA..."
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Define a personalidade, regras e tom da IA em todas as conversas. Os flows ativos e as infos da empresa sao adicionados automaticamente.
                </p>
              </div>

              {/* Model & Params */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Modelo
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Temperatura ({temperature})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="mt-2 w-full"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Preciso</span>
                    <span>Criativo</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Max Tokens
                  </label>
                  <Input
                    type="number"
                    min={100}
                    max={2000}
                    step={50}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 500)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Company tab */
            <>
              <p className="text-xs text-gray-400">
                Essas informacoes sao injetadas automaticamente no contexto da IA para que ela possa responder sobre a empresa.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Nome da empresa
                  </label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="BoraRun"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Site
                  </label>
                  <Input
                    value={companySite}
                    onChange={(e) => setCompanySite(e.target.value)}
                    placeholder="https://borarun.com.br"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Instagram
                  </label>
                  <Input
                    value={companyInstagram}
                    onChange={(e) => setCompanyInstagram(e.target.value)}
                    placeholder="@borarun"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Telefone / WhatsApp
                  </label>
                  <Input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="(51) 99999-9999"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  E-mail
                </label>
                <Input
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="contato@borarun.com.br"
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Descricao da empresa
                </label>
                <textarea
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-gray-400"
                  placeholder="Descreva o que a empresa faz, publico-alvo, diferenciais..."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Informacoes extras
                </label>
                <textarea
                  value={companyExtra}
                  onChange={(e) => setCompanyExtra(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-gray-400"
                  placeholder="Horario de funcionamento, planos, precos, enderecos, politica de cancelamento, etc."
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            {activeTab === "coach" ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs text-gray-400"
                onClick={handleReset}
              >
                <RotateCcw size={12} />
                Restaurar padrao
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              {isSaved && <span className="text-xs text-green-600">Salvo!</span>}
              <Button
                size="sm"
                onClick={() =>
                  void (activeTab === "coach" ? handleSave() : handleSaveCompany())
                }
                disabled={isSaving}
                className="gap-1"
              >
                {isSaving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
