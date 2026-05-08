import { RingProgress } from "./RingProgress";
import { metersToKm } from "@/lib/utils";

interface WeeklyRunningCardsProps {
  currentWeekNumber: number;
  completedRuns: number;
  totalRuns: number;
  completedDistance: number;
  totalDistance: number;
}

export const WeeklyRunningCards = ({
  currentWeekNumber,
  completedRuns,
  totalRuns,
  completedDistance,
  totalDistance,
}: WeeklyRunningCardsProps) => {
  const runsPercentage = totalRuns > 0 ? Math.min((completedRuns / totalRuns) * 100, 100) : 0;
  const distancePercentage = totalDistance > 0 ? Math.min((completedDistance / totalDistance) * 100, 100) : 0;
  const completedKm = metersToKm(completedDistance);
  const totalKm = metersToKm(totalDistance);

  return (
    <div className="px-4 pb-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1 - Corridas Completadas */}
        <div className="bg-card rounded-[20px] shadow-lg p-4 flex flex-col gap-3">
          {/* Cabeçalho */}
          <h3 className="text-sm font-medium text-muted-foreground uppercase">
            Semana {currentWeekNumber}
          </h3>

          {/* Número grande */}
          <div className="text-6xl font-bold tracking-tight leading-none text-card-foreground">
            {completedRuns}/{totalRuns}
          </div>

          {/* Footer com barra */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Corrida
              </span>
              {/* Barra de progresso visual */}
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${runsPercentage}%` }}
                />
              </div>
              <span className="text-xs font-bold text-card-foreground">
                {completedRuns}/{totalRuns}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2 - Distância Total */}
        <div className="bg-card rounded-[20px] shadow-lg p-4 flex flex-col items-center justify-between">
          {/* Cabeçalho invisível para alinhamento */}
          <div className="h-5" />

          {/* Anel de progresso */}
          <div className="relative flex-1 flex items-center justify-center">
            <RingProgress
              percentage={distancePercentage}
              size={120}
              strokeWidth={10}
              showIcon={false}
              color="hsl(var(--primary))"
            />
            {/* Texto central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex items-baseline">
                <span className="text-3xl font-bold leading-none text-card-foreground">
                  {completedKm.toFixed(1).replace('.', ',')}
                </span>
                <span className="text-xl font-bold text-muted-foreground leading-none">
                  /{totalKm.toFixed(1).replace('.', ',')}
                </span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">km</span>
            </div>
          </div>

          {/* Label inferior */}
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center leading-tight mt-2">
            Distância Total<br />Semanal
          </p>
        </div>
      </div>
    </div>
  );
};
