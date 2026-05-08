import { Plus, UtensilsCrossed, Dumbbell, Weight, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

interface FABProps {
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
}

export const FAB = ({ onClick, disabled, tooltip }: FABProps) => {
  const location = useLocation();

  // Determinar o ícone baseado na rota atual
  const getIcon = () => {
    switch (location.pathname) {
      case '/dashboard':
        return Activity; // Ícone de corrida/atividade
      case '/exercise':
        return Dumbbell; // Ícone de exercício
      case '/balance':
        return Weight; // Ícone de peso
      default:
        return Plus; // Ícone padrão
    }
  };

  const IconComponent = getIcon();

  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "fixed right-6 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all z-50 bottom-24",
        disabled
          ? "bg-muted text-muted-foreground cursor-not-allowed"
          : "bg-foreground text-background hover:scale-105 active:scale-95"
      )}
      aria-label="Adicionar entrada"
    >
      <div className="relative flex items-center justify-center">
        <IconComponent className="w-7 h-7" strokeWidth={2.5} />
        <div className="absolute -top-4 -right-4 w-5 h-5 bg-white rounded-full shadow-lg flex items-center justify-center">
          <Plus className="w-3 h-3 text-foreground" strokeWidth={3} />
        </div>
      </div>
    </button>
  );

  if (disabled && tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};
