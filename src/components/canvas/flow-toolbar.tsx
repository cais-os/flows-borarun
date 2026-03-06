"use client";

import { MessageCircle, PenTool } from "lucide-react";
import { useFlowStore } from "@/hooks/use-flow-store";
import { useSimulatorStore } from "@/hooks/use-simulator-store";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { ActiveTab } from "@/types/simulator";
import { cn } from "@/lib/utils";

interface FlowToolbarProps {
  onSelectTab?: (tab: ActiveTab) => void;
}

const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: "flows", label: "Flows", icon: <PenTool size={20} /> },
  { id: "conversations", label: "Conversas", icon: <MessageCircle size={20} /> },
];

export function FlowToolbar({ onSelectTab }: FlowToolbarProps) {
  const isDirty = useFlowStore((s) => s.isDirty);
  const activeTab = useSimulatorStore((s) => s.activeTab);
  const setActiveTab = useSimulatorStore((s) => s.setActiveTab);

  const handleTabClick = (tab: ActiveTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
      return;
    }

    setActiveTab(tab);
  };

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-slate-200 bg-white/90 py-4 backdrop-blur">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
        BR
      </div>

      <div className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                  activeTab === item.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {item.icon}
                {item.id === "flows" && isDirty && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-amber-400" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </aside>
  );
}
