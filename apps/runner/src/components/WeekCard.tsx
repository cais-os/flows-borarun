import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Check, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TrainingWeek, trainingTypeColors } from "@/types/training";
import { metersToKm, secondsToTimeString, translateWeekday } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

interface WeekCardProps {
  week: TrainingWeek;
  isDisabled?: boolean;
  shouldBlur?: boolean;
}

export const WeekCard = ({ week, isDisabled = false, shouldBlur = false }: WeekCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const startDate = new Date(week.startDate);
  const endDate = new Date(week.endDate);

  const formattedPeriod = `${format(startDate, "d MMM", { locale: ptBR }).toUpperCase()} - ${format(endDate, "d MMM", { locale: ptBR }).toUpperCase()}`;

  const formatDuration = (seconds: number): string => {
    return secondsToTimeString(seconds || 0);
  };

  const handleClick = () => {
    if (isDisabled) return;
    // Track week card opened
    if (user?.id) {
      track('activity_opened_week_card', user.id, {
        metadata: { weekNumber: week.weekNumber },
      });
    }
    navigate(`/week/${week.weekNumber}`);
  };

  return (
    <Card
      className={`border-none shadow-sm rounded-[20px] p-5 mb-4 transition-shadow select-none ${
        isDisabled 
          ? 'pointer-events-none' 
          : 'cursor-pointer hover:shadow-md'
      } ${
        shouldBlur 
          ? 'blur-sm opacity-60' 
          : ''
      }`}
      onClick={handleClick}
    >
      {/* Título da semana */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-2xl font-bold">Semana {week.weekNumber}</h2>
        <div className="h-4 w-px bg-muted-foreground/30"></div>
        <p className="text-xs text-muted-foreground/70 font-medium">
          {formattedPeriod}
        </p>
      </div>

      {/* Barra de progresso */}
      <div className="flex gap-2 mb-3">
        {Array.from({ length: week.totalTrainings }).map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-2 rounded-full ${index < week.completedTrainings ? 'bg-primary' : 'bg-muted'
              }`}
          />
        ))}
      </div>

      {/* Métricas */}
      <div className="flex flex-col gap-2 mb-4 text-sm">
        <p className="text-muted-foreground font-brand-tertiary flex items-center whitespace-nowrap">
          <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="font-black text-foreground font-brand-tertiary mr-1">
            {metersToKm(week.completedDistance).toFixed(2).replace('.', ',')} km
          </span>
          /
          <span className="text-muted-foreground ml-1 mr-1">
            {metersToKm(week.totalDistance).toFixed(2).replace('.', ',')}
          </span> km
        </p>
        <p className="text-muted-foreground font-brand-tertiary flex items-center whitespace-nowrap">
          <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="font-black text-foreground font-brand-tertiary mr-1">{formatDuration(week.completedDuration)}</span>/<span className="text-muted-foreground ml-1 mr-1">{formatDuration(week.totalDuration)}</span>
        </p>
      </div>

      {/* Lista de treinos */}
      <div className="space-y-3 pt-4">
        {week.trainings.map((training, index) => (
          <div key={index} className="flex items-center gap-3">
            {/* Quadrado colorido */}
            <div
              className="w-6 h-6 rounded-md flex-shrink-0"
              style={{ backgroundColor: trainingTypeColors[training.type] }}
            />

            {/* Dia da semana */}
            <span className="text-sm font-bold text-foreground min-w-[35px] font-brand-tertiary">
              {translateWeekday(training.day)}
            </span>

            {/* Nome do treino */}
            <span className="text-sm text-foreground flex items-center font-brand-tertiary flex-1">
              {training.title}
              {training.completed && (
                <Check className="w-4 h-4 text-green ml-2" />
              )}
            </span>

            {/* Distância com ícone no final */}
            <span className="text-sm text-foreground flex items-center font-brand-tertiary">
              <MapPin className="w-3 h-3 mr-1" /> {metersToKm(training.distance).toFixed(2).replace('.', ',')} km
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
