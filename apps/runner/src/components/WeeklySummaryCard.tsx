import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface WeeklySummaryCardProps {
  completedRuns: number;
  totalRuns: number;
  completedDistance: number;
  totalDistance: number;
}

export const WeeklySummaryCard = ({ 
  completedRuns, 
  totalRuns,
  completedDistance,
  totalDistance
}: WeeklySummaryCardProps) => {
  const navigate = useNavigate();
  
  const completionPercentage = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  
  const getMotivationalMessage = () => {
    if (completionPercentage === 100) {
      return "Semana perfeita! Você completou todos os treinos! 🎉";
    } else if (completionPercentage >= 75) {
      return "Ótimo trabalho esta semana! Continue assim! 💪";
    } else if (completionPercentage >= 50) {
      return "Bom progresso! Vamos manter o ritmo! 🏃";
    } else if (completionPercentage > 0) {
      return "Ótimo começo! Continue firme no seu objetivo! 💚";
    } else {
      return "Hora de começar! Seu plano está te esperando! 🚀";
    }
  };

  return (
    <div className="px-4 pb-6">
      <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="p-5">
          <h3 className="text-lg font-bold text-foreground mb-2">
            Progresso da Semana
          </h3>
          
          <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
            {getMotivationalMessage()}
          </p>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">
                {completedRuns}/{totalRuns}
              </div>
              <div className="text-xs text-muted-foreground">Treinos</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">
                {completedDistance.toFixed(1)}km
              </div>
              <div className="text-xs text-muted-foreground">de {totalDistance.toFixed(1)}km</div>
            </div>
          </div>
          
          <Button 
            variant="secondary" 
            className="w-full"
            onClick={() => navigate('/plan')}
          >
            Ver plano completo
          </Button>
        </div>
      </Card>
    </div>
  );
};
