"use client";

import { Loader2, Power, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFlowStore } from "@/hooks/use-flow-store";
import { cn } from "@/lib/utils";

interface FlowWorkspaceHeaderProps {
  onSave: () => Promise<unknown>;
  isSaving: boolean;
}

export function FlowWorkspaceHeader({
  onSave,
  isSaving,
}: FlowWorkspaceHeaderProps) {
  const flowName = useFlowStore((s) => s.flowName);
  const flowIsActive = useFlowStore((s) => s.flowIsActive);
  const setFlowName = useFlowStore((s) => s.setFlowName);
  const setFlowActive = useFlowStore((s) => s.setFlowActive);
  const isDirty = useFlowStore((s) => s.isDirty);

  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
      <Input
        value={flowName}
        onChange={(event) => setFlowName(event.target.value)}
        placeholder="Nome do flow"
        className="h-auto w-48 border-transparent bg-transparent px-1 py-0 text-sm font-semibold text-slate-900 shadow-none placeholder:text-slate-300 focus-visible:border-transparent focus-visible:ring-0"
      />

      <button
        type="button"
        onClick={() => setFlowActive(!flowIsActive, true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
          flowIsActive
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-100 text-slate-600"
        )}
      >
        <Power size={12} />
        {flowIsActive ? "Ativo" : "Inativo"}
      </button>

      <Button
        size="sm"
        className="h-7 rounded-lg px-3 text-xs"
        onClick={() => void onSave()}
        disabled={isSaving || !isDirty}
      >
        {isSaving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Save size={12} />
        )}
        {isSaving ? "Salvando" : "Salvar"}
      </Button>
    </div>
  );
}
