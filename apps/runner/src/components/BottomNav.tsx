import { Settings, Calendar, Clipboard, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

interface BottomNavProps {
  activeTab: "food" | "week" | "settings" | "treinador";
  onTabChange?: (tab: "food" | "week" | "settings" | "treinador") => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tabs = [
    { id: "treinador" as const, icon: MessageCircle, path: "/treinador", label: "Treinador" },
    { id: "food" as const, icon: Calendar, path: "/dashboard", label: "Agenda" },
    { id: "week" as const, icon: Clipboard, path: "/plan", label: "Plano" },
    { id: "settings" as const, icon: Settings, path: "/settings", label: "Ajustes" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="flex items-center justify-around h-20 max-w-md mx-auto px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                // Track tab navigation - apenas se estiver trocando de aba
                if (user?.id && tab.id !== activeTab) {
                  const eventMap: Record<string, string> = {
                    'treinador': 'activity_tab_trainer',
                    'food': 'activity_tab_daily',
                    'week': 'activity_tab_plan',
                    'settings': 'activity_tab_settings',
                  };
                  const eventName = eventMap[tab.id];
                  if (eventName) {
                    track(eventName, user.id);
                  }
                }
                navigate(tab.path);
                onTabChange?.(tab.id);
              }}
              className="flex flex-col items-center justify-center min-w-[60px] gap-1 transition-colors"
            >
              <Icon
                className="w-6 h-6"
                style={{
                  color: isActive ? '#000000' : '#9ca3af'
                }}
                strokeWidth={2}
              />
              <span
                className={`text-xs ${isActive ? 'font-bold' : 'font-light'}`}
                style={{
                  color: isActive ? '#000000' : '#9ca3af'
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
