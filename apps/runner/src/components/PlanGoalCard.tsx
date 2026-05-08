import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { goalTypeLabels } from "@/types/training";
import { Calendar, Footprints, MapPin, Clock } from "lucide-react";
import { metersToKm, secondsToTimeString } from "@/lib/utils";

interface PlanGoalCardProps {
  goalType: 'start_running' | 'half_marathon' | 'marathon' | '10k' | '5k' | 'specific_distance';
  goalDistance: number;
  raceDate: string | null;
  totalWeeks: number;
  completedWeeks: number | null;
  totalDistance: number | null;
  completedDistance: number | null;
  totalDuration: number | null;
  completedDuration: number | null;
  totalTrainings: number;
  completedTrainings: number;
}

export const PlanGoalCard = ({
  goalType,
  goalDistance,
  raceDate,
  totalWeeks,
  completedWeeks,
  totalDistance,
  completedDistance,
  totalDuration,
  completedDuration,
  totalTrainings,
  completedTrainings,
}: PlanGoalCardProps) => {
  const formattedRaceDate = raceDate
    ? format(new Date(raceDate), "dd 'DE' MMMM 'DE' yyyy", { locale: ptBR }).toUpperCase()
    : "Data não definida";

  const formatDuration = (seconds: number): string => {
    const totalSeconds = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0 && minutes > 0) {
      return `${hours} h e ${minutes} min`;
    } else if (hours > 0) {
      return `${hours} h`;
    } else if (minutes > 0) {
      return `${minutes} min`;
    }
    return '0 min';
  };

  const capitalizeFirstLetter = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Formata a distância: remove decimais desnecessários e usa vírgula
  const formatDistanceKm = (distanceMeters: number | null): string => {
    const km = metersToKm(distanceMeters || 0);
    if (km % 1 === 0) {
      return km.toString();
    }
    return km.toFixed(1).replace('.', ',');
  };

  // Formata distância que já está em km (para goalDistance)
  const formatDistanceKmDirect = (distanceKm: number): string => {
    if (distanceKm % 1 === 0) {
      return distanceKm.toString();
    }
    return distanceKm.toFixed(1).replace('.', ',');
  };

  // Determina o label do objetivo
  const getGoalLabel = (): string => {
    // Se for 'specific_distance' ou não estiver no goalTypeLabels, usar a distância
    if (goalType === 'specific_distance' || !goalTypeLabels[goalType as keyof typeof goalTypeLabels]) {
      return `${formatDistanceKmDirect(goalDistance)}km`;
    }
    return goalTypeLabels[goalType as keyof typeof goalTypeLabels] || 'corrida';
  };

  const goalLabel = getGoalLabel();

  return (
    <Card className="border-none shadow-sm rounded-[20px] p-6 relative overflow-hidden">
      {/* Badge */}
      <div className="absolute top-4 right-4 rounded-xl p-2.5 shadow-md flex items-center justify-center" style={{ backgroundColor: '#daf46c' }}>
        <p className="text-black font-bold text-sm">{formatDistanceKmDirect(goalDistance)} km</p>
      </div>

      {/* Título */}
      <h1 className="text-2xl font-bold mb-2 pr-20 sm:pr-24">
        Plano para {capitalizeFirstLetter(goalLabel)}
      </h1>

      {/* Data da prova */}
      {raceDate && (
        <p className="text-sm text-muted-foreground mb-6 pr-20 sm:pr-24">
          Sua prova: {formattedRaceDate}
        </p>
      )}
      {!raceDate && <div className="mb-6" />}

      {/* Barra de progresso */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: totalWeeks }).map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-2 rounded-full ${index < (completedWeeks || 0) ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {/* Métricas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <Calendar className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground font-brand-tertiary flex-1">
            Você está na <span className="font-bold text-foreground">semana {completedWeeks || 0} de {totalWeeks}</span> do seu plano de treino.
          </p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <Footprints className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground font-brand-tertiary flex-1">
            Você já correu <span className="font-bold text-foreground">{completedTrainings} das {totalTrainings} corridas</span> planejadas para você.
          </p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <MapPin className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground font-brand-tertiary flex-1">
            Você já percorreu <span className="font-bold text-foreground">{formatDistanceKm(completedDistance)} km</span> dos <span className="font-bold text-foreground">{formatDistanceKm(totalDistance)} km</span> totais de seu plano.
          </p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground font-brand-tertiary flex-1">
            Você já treinou <span className="font-bold text-foreground">{formatDuration(completedDuration || 0)}</span> das <span className="font-bold text-foreground">{formatDuration(totalDuration || 0)}</span> planejadas.
          </p>
        </div>
      </div>
    </Card>
  );
};
