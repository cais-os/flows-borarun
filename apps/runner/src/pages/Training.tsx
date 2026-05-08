import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Share2, Clock } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { CoachTipCard } from '@/components/CoachTipCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTraining } from '@/hooks/useTraining';
import { useUpdateTraining } from '@/hooks/useUpdateTraining';
import { trainingTypeColors, trainingConfig } from '@/types/training';
import { CompleteTrainingDialog } from '@/components/CompleteTrainingDialog';
import { formatTimeWithoutSeconds, abbreviateWeekday } from '@/lib/utils';

const Training = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state as { from?: string; selectedDate?: string; currentWeekNumber?: number };
  const { data: training, isLoading, error } = useTraining(id || '');
  const updateTraining = useUpdateTraining();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-10 rounded-full mb-4" />
          <Skeleton className="w-full h-48 rounded-[20px]" />
          <Skeleton className="w-full h-32 rounded-[20px]" />
          <Skeleton className="w-full h-40 rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Treino não encontrado</p>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Garantir parsing correto da data (adicionar T12:00:00 para evitar mudança de dia por timezone)
  const dateObj = typeof training.date === 'string'
    ? new Date(training.date + 'T12:00:00')
    : new Date(training.date);
  const color = trainingTypeColors[training.type as keyof typeof trainingTypeColors] || '#9b87f5';
  const typeLabel = trainingConfig[training.type as keyof typeof trainingConfig]?.label || training.type;

  const handleBack = () => {
    navigate('/dashboard', {
      state: {
        selectedDate: fromState?.selectedDate || training.date,
        currentWeekNumber: fromState?.currentWeekNumber
      }
    });
  };

  const handleToggleComplete = () => {
    if (training.completed) {
      // Se já está concluído, desmarcar diretamente
      updateTraining.mutate({
        trainingId: training.id,
        completed: false,
      });
    } else {
      // Se não está concluído, abrir dialog
      setShowCompleteDialog(true);
    }
  };

  const handleConfirmComplete = (data: {
    distance: number;
    time: number;
    pace: string;
  }) => {
    updateTraining.mutate({
      trainingId: training.id,
      completed: true,
      actualDistance: data.distance,
      actualTime: data.time.toString(),
      actualPace: data.pace,
    });
    setShowCompleteDialog(false);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-md mx-auto">
        {/* Hero Section com gradiente estendido até o topo */}
        <div
          className="px-4 pt-6 pb-8 mb-4"
          style={{
            background: `linear-gradient(to bottom, ${color}30, ${color}10, transparent)`
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full mb-6 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <p className="text-sm text-muted-foreground mb-2 capitalize">
            {abbreviateWeekday(format(dateObj, "EEEE", { locale: ptBR }))}, {format(dateObj, "d 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {training.title}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-base">{training.duration} min</span>
          </div>
        </div>

        <div className="px-4 space-y-4 pb-24">
          {/* Card de Métricas Planejadas */}
          <Card className="relative overflow-hidden border-none shadow-sm rounded-[20px]">
            <div
              className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg"
              style={{ backgroundColor: color }}
            />

            <div className="pl-6 pr-4 py-4 space-y-3">
              <h2 className="text-lg font-bold text-foreground mb-2">Planejado</h2>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Distância</span>
                <span className="text-lg font-semibold">{training.distance} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tempo sugerido</span>
                <span className="text-lg font-semibold">{training.duration} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ritmo sugerido</span>
                <span className="text-lg font-semibold">{training.pace}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo</span>
                <span className="text-lg font-semibold">{typeLabel}</span>
              </div>
            </div>
          </Card>

          {/* Card de Métricas Realizadas */}
          {training.completed && training.actual_distance && (
            <Card className="relative overflow-hidden border-none shadow-sm rounded-[20px]">
              <div
                className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg"
                style={{ backgroundColor: color }}
              />

              <div className="pl-6 pr-4 py-4 space-y-3">
                <h2 className="text-lg font-bold text-foreground mb-2">Realizado</h2>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Distância</span>
                  <span className="text-lg font-semibold">{training.actual_distance} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tempo</span>
                  <span className="text-lg font-semibold">{formatTimeWithoutSeconds(training.actual_time)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ritmo</span>
                  <span className="text-lg font-semibold">{training.actual_pace}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Card de Descrição */}
          {training.description && (
            <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-4">
              <div className="px-5 py-4">
                <h2 className="text-lg font-bold mb-3 text-foreground">
                  Descrição do Treino
                </h2>
                <div className="space-y-2">
                  {training.description.split('\n').map((line, i) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return null;

                    if (trimmedLine.startsWith('•')) {
                      return (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="text-sm text-muted-foreground leading-relaxed flex-1">
                            {trimmedLine.replace('•', '').trim()}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                        {trimmedLine}
                      </p>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* Botão fixo de conclusão */}
      <div className="fixed bottom-16 left-0 right-0 bg-background p-4 z-10">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleToggleComplete}
            disabled={updateTraining.isPending}
            className={`w-full h-12 rounded-xl font-semibold transition-all ${training.completed
              ? 'text-white'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            style={training.completed ? { backgroundColor: color } : undefined}
          >
            {training.completed ? '✓ Treino Concluído' : 'Marcar como Concluído'}
          </Button>
        </div>
      </div>

      <CompleteTrainingDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        training={training}
        onConfirm={handleConfirmComplete}
      />

      <BottomNav activeTab="week" />
    </div>
  );
};

export default Training;
