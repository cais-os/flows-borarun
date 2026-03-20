"use client";

import {
  BarChart3,
  LogOut,
  Megaphone,
  MessageCircle,
  PenTool,
  Plug,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  { id: "conversations", label: "Conversas", icon: <MessageCircle size={20} /> },
  { id: "flows", label: "Flows", icon: <PenTool size={20} /> },
  { id: "campanhas", label: "Campanhas", icon: <Megaphone size={20} /> },
  { id: "integrations", label: "Integracoes", icon: <Plug size={20} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={20} /> },
];

export function FlowToolbar({ onSelectTab }: FlowToolbarProps) {
  const router = useRouter();
  const isDirty = useFlowStore((s) => s.isDirty);
  const activeTab = useSimulatorStore((s) => s.activeTab);
  const setActiveTab = useSimulatorStore((s) => s.setActiveTab);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleTabClick = (tab: ActiveTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
      return;
    }

    setActiveTab(tab);
  };

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center border-r border-slate-200 bg-white/90 py-4 backdrop-blur">
      <div className="flex flex-1 flex-col items-center gap-1">
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

      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleTabClick("settings")}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                activeTab === "settings"
                  ? "bg-slate-900 text-white"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              )}
              aria-label="Configuracoes"
            >
              <Settings size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Configuracoes</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void handleLogout()}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <LogOut size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sair</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
