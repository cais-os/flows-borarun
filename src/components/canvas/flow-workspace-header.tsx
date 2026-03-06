"use client";

import { ArrowLeft, GitBranch, Loader2, Power, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFlowStore } from "@/hooks/use-flow-store";
import { getFlowTriggerLabels } from "@/lib/flow-persistence";
import { cn } from "@/lib/utils";

interface FlowWorkspaceHeaderProps {
  onSave: () => Promise<unknown>;
  isSaving: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveTarget: "local" | "remote" | null;
  saveError: string | null;
  lastSavedAt: string | null;
  onBackToList?: () => void;
}

export function FlowWorkspaceHeader({
  onSave,
  isSaving,
  saveStatus,
  saveTarget,
  saveError,
  lastSavedAt,
  onBackToList,
}: FlowWorkspaceHeaderProps) {
  const flowName = useFlowStore((s) => s.flowName);
  const flowIsActive = useFlowStore((s) => s.flowIsActive);
  const setFlowName = useFlowStore((s) => s.setFlowName);
  const setFlowActive = useFlowStore((s) => s.setFlowActive);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const isDirty = useFlowStore((s) => s.isDirty);
  const triggerLabels = getFlowTriggerLabels(nodes);

  const formattedSaveTime = lastSavedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastSavedAt))
    : null;

  const statusLabel = isSaving
    ? "Salvando..."
    : isDirty
      ? "Alteracoes pendentes"
      : saveStatus === "saved" && saveTarget === "remote"
        ? formattedSaveTime
          ? `Salvo na nuvem as ${formattedSaveTime}`
          : "Salvo na nuvem"
        : saveStatus === "saved" && saveTarget === "local"
          ? formattedSaveTime
            ? `Salvo no navegador as ${formattedSaveTime}`
            : "Salvo no navegador"
          : saveStatus === "error"
            ? "Erro ao salvar"
            : "Sem alteracoes pendentes";

  return (
    <header className="border-b border-slate-200 bg-white/85 px-6 py-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {onBackToList && (
              <Button
                size="xs"
                variant="outline"
                className="rounded-full"
                onClick={onBackToList}
              >
                <ArrowLeft size={12} />
                Lista de flows
              </Button>
            )}

            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              Editor do flow
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Input
              value={flowName}
              onChange={(event) => setFlowName(event.target.value)}
              placeholder="Nome do flow"
              className="h-auto max-w-3xl border-transparent bg-transparent px-0 py-0 text-2xl font-semibold text-slate-900 shadow-none placeholder:text-slate-300 focus-visible:border-transparent focus-visible:ring-0"
            />

            <Badge
              variant={isSaving || isDirty ? "secondary" : "outline"}
              className={
                isSaving
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : isDirty
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }
            >
              {statusLabel}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              {nodes.length} nos
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              {edges.length} conexoes
            </span>
            <button
              type="button"
              onClick={() => setFlowActive(!flowIsActive, true)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors",
                flowIsActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              )}
            >
              <Power size={12} />
              {flowIsActive ? "Flow ativo" : "Flow inativo"}
            </button>
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              <GitBranch size={12} />
              Auto-save apos 2s sem editar
            </span>
            {triggerLabels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700"
              >
                {label}
              </span>
            ))}
          </div>
          {saveError && !isDirty && (
            <p className="mt-3 text-xs text-amber-700">{saveError}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => void onSave()}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? "Salvando" : "Salvar agora"}
          </Button>
        </div>
      </div>
    </header>
  );
}
