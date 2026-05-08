import { useMemo, useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNearbyTrainings } from '@/hooks/useNearbyTrainings';
import { useLinkStravaActivity } from '@/hooks/useLinkStravaActivity';
import { metersToKm, paceSecondsToFormatted, secondsToTimeString } from '@/lib/utils';
import { trainingConfig, trainingTypeColors } from '@/types/training';
import { Activity, Clock, MapPin } from 'lucide-react';

interface LinkStravaTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityDate: string | Date | null | undefined;
  stravaActivityId: number;
  onLinked?: () => void;
}

const toDate = (input: string | Date) => (input instanceof Date ? input : parseISO(input));

export const LinkStravaTrainingDialog = ({
  open,
  onOpenChange,
  activityDate,
  stravaActivityId,
  onLinked,
}: LinkStravaTrainingDialogProps) => {
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);

  const activityDateObj = useMemo(() => {
    if (!activityDate) return null;
    const parsed = toDate(activityDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  }, [activityDate]);

  const { data: nearbyTrainings, isLoading } = useNearbyTrainings(activityDateObj, 7, 15);
  const linkStrava = useLinkStravaActivity();

  const handleConfirm = () => {
    if (!selectedTrainingId) return;
    linkStrava.mutate(
      {
        stravaActivityId,
        trainingId: selectedTrainingId,
      },
      {
        onSuccess: () => {
          setSelectedTrainingId(null);
          onLinked?.();
          onOpenChange(false);
        },
      },
    );
  };

  const renderDiffLabel = (trainingDate: string) => {
    if (!activityDateObj) return null;
    const trainingDateObj = toDate(trainingDate);
    const diff = differenceInCalendarDays(trainingDateObj, activityDateObj);
    if (diff === 0) return 'Mesma data';
    const suffix = diff > 0 ? 'depois' : 'antes';
    return `${Math.abs(diff)} dia(s) ${suffix}`;
  };

  const formatDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const formatted = format(d, "dd/MM (EEE)", { locale: ptBR }).toUpperCase();
    // Garantir abreviação de 3 letras para o dia
    return formatted.replace(/\((.{3}).*\)/, (_, day) => `(${day})`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-2rem)] rounded-[18px]">
        <DialogHeader>
          <DialogTitle>Vincular ao plano</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Selecione o treino do plano mais próximo para vincular esta atividade do Strava.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ScrollArea className="max-h-[360px] h-[360px] pr-2">
            <div className="space-y-2">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Carregando treinos próximos...</p>
              )}

              {!isLoading && (!nearbyTrainings || nearbyTrainings.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  Não encontramos treinos do plano próximos a essa data sem vínculo com Strava.
                </p>
              )}

              {nearbyTrainings?.map(({ training }) => {
                const isSelected = selectedTrainingId === training.id;
                const diffLabel = activityDateObj ? renderDiffLabel(training.date) : null;
                const distanceKm = training.distance ? metersToKm(Number(training.distance)).toFixed(1) : null;
                const color = trainingTypeColors[training.type as keyof typeof trainingTypeColors] ?? '#0f172a';
                const title = training.title || training.name || trainingConfig[training.type as keyof typeof trainingConfig]?.label || 'Treino do plano';
                const pace = training.pace ?? (training.elapsed_time && training.distance ? Math.round(training.elapsed_time / (training.distance / 1000)) : null);

                return (
                  <Card
                    key={training.id}
                    className={`relative overflow-hidden border-none shadow-sm rounded-lg cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary/50' : ''
                      }`}
                    onClick={() =>
                      setSelectedTrainingId((prev) => (prev === training.id ? null : training.id))
                    }
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex items-start justify-between gap-2 p-2 pl-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{formatDate(training.date)}</span>
                          {diffLabel && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                              {diffLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground font-semibold tracking-wide">
                          {title}
                        </p>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground font-brand-tertiary pt-1">
                          {distanceKm && (
                            <p className="flex items-center whitespace-nowrap">
                              <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="font-semibold text-foreground">
                                {distanceKm.replace('.', ',')} km
                              </span>
                            </p>
                          )}
                          {training.elapsed_time && (
                            <p className="flex items-center whitespace-nowrap">
                              <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="font-semibold text-foreground">
                                {secondsToTimeString(Number(training.elapsed_time))}
                              </span>
                            </p>
                          )}
                          {pace !== null && (
                            <p className="flex items-center whitespace-nowrap">
                              <Activity className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="font-semibold text-foreground">
                                {paceSecondsToFormatted(pace)}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div
                          className={`h-4 w-4 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="font-brand-primary uppercase tracking-wide font-bold"
            onClick={() => onOpenChange(false)}
            disabled={linkStrava.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="font-brand-primary uppercase tracking-wide font-bold"
            disabled={!selectedTrainingId || linkStrava.isPending}
          >
            {linkStrava.isPending ? 'Vinculando...' : 'Vincular Treino'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
