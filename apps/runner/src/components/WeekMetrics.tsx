interface WeekMetricsProps {
  totalTrainings: number;
  completedTrainings: number;
  totalDistance: number;
}

export const WeekMetrics = ({ totalTrainings, completedTrainings, totalDistance }: WeekMetricsProps) => {
  return (
    <div className="px-4 pb-4">
      {/* Barra de progresso */}
      <div className="flex gap-2 mb-3">
        {Array.from({ length: totalTrainings }).map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-2 rounded-full transition-colors ${
              index < completedTrainings ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      
      {/* Métricas */}
      <div className="text-sm text-foreground space-y-1">
        <p>Total de treinos: <span className="font-semibold">{totalTrainings}</span></p>
        <p>Distância: <span className="font-semibold">{totalDistance.toFixed(2)} km</span></p>
      </div>
    </div>
  );
};
