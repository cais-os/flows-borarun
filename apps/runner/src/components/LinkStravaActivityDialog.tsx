import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Clock, MapPin } from 'lucide-react';
import { metersToKm, paceSecondsToFormatted, secondsToTimeString } from '@/lib/utils';
import { useUnlinkedStravaActivities } from '@/hooks/useUnlinkedStravaActivities';
import { useLinkStravaActivity } from '@/hooks/useLinkStravaActivity';

interface LinkStravaActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingDate: string | Date | null | undefined;
  trainingId: string;
  onLinked?: () => void;
}

const toDate = (input: string | Date | null | undefined) => {
  if (!input) return null;
  if (input instanceof Date) return input;
  const parsed = parseISO(input);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const LinkStravaActivityDialog = ({
  open,
  onOpenChange,
  trainingDate,
  trainingId,
  onLinked,
}: LinkStravaActivityDialogProps) => {
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);

  const trainingDateObj = useMemo(() => {
    if (!trainingDate) return null;
    const parsed = toDate(trainingDate);
    return parsed;
  }, [trainingDate]);

  const { data: activities, isLoading } = useUnlinkedStravaActivities(trainingDateObj, 7, 20);
  const linkStrava = useLinkStravaActivity();

  const handleConfirm = () => {
    if (!selectedActivityId) return;
    linkStrava.mutate(
      {
        stravaActivityId: selectedActivityId,
        trainingId,
      },
      {
        onSuccess: () => {
          setSelectedActivityId(null);
          onLinked?.();
          onOpenChange(false);
        },
      },
    );
  };

  const renderDiffLabel = (activityDate: string | null | undefined) => {
    if (!trainingDateObj || !activityDate) return null;
    const activityDateObj = toDate(activityDate);
    if (!activityDateObj) return null;
    const diff = differenceInCalendarDays(activityDateObj, trainingDateObj);
    if (diff === 0) return 'Mesma data';
    const suffix = diff > 0 ? 'depois' : 'antes';
    return `${Math.abs(diff)} dia(s) ${suffix}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Data indefinida';
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const formatted = format(d, "dd/MM (EEE)", { locale: ptBR }).toUpperCase();
    return formatted.replace(/\((.{3}).*\)/, (_, day) => `(${day})`);
  };

  const formatPace = (activity: any) => {
    const distance = activity?.distance ? Number(activity.distance) : null;
    const elapsed = activity?.elapsed_time ?? activity?.moving_time ?? null;
    const avgSpeed = activity?.average_speed;

    let paceSeconds: number | null = null;
    if (distance && elapsed) {
      paceSeconds = Math.round(elapsed / (distance / 1000));
    } else if (avgSpeed) {
      // average_speed em m/s -> pace em s/km
      paceSeconds = Math.round(1000 / avgSpeed);
    }

    return paceSeconds;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-2rem)] rounded-[18px]">
        <DialogHeader>
          <DialogTitle>Vincular atividade Strava</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Selecione a atividade do Strava para vincular a este treino do plano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ScrollArea className="max-h-[360px] h-[360px] pr-2">
            <div className="space-y-2">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Carregando atividades próximas...</p>
              )}

              {!isLoading && (!activities || activities.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  Não encontramos atividades do Strava próximas a essa data sem vínculo com o plano.
                </p>
              )}

              {activities?.map(({ activity }) => {
                const isSelected = selectedActivityId === activity.activity_id;
                const diffLabel = trainingDateObj ? renderDiffLabel(activity.start_date || activity.start_date_local) : null;
                const distanceKm = activity.distance ? metersToKm(Number(activity.distance)).toFixed(1) : null;
                const paceSeconds = formatPace(activity);
                const elapsed = activity.elapsed_time ?? activity.moving_time ?? null;

                return (
                  <Card
                    key={activity.activity_id}
                    className={`relative overflow-hidden border-none shadow-sm rounded-lg cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary/50' : ''
                      }`}
                    onClick={() =>
                      setSelectedActivityId((prev) => (prev === activity.activity_id ? null : activity.activity_id))
                    }
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2"
                      style={{ backgroundColor: '#e2e8f0' }}
                    />
                    <div className="flex items-start justify-between gap-2 p-3 pl-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">
                            {formatDate(activity.start_date_local ?? activity.start_date)}
                          </span>
                          {diffLabel && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                              {diffLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground font-semibold tracking-wide">
                          {activity.name || 'Atividade do Strava'}
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
                          {elapsed && (
                            <p className="flex items-center whitespace-nowrap">
                              <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="font-semibold text-foreground">
                                {secondsToTimeString(Number(elapsed))}
                              </span>
                            </p>
                          )}
                          {paceSeconds !== null && (
                            <p className="flex items-center whitespace-nowrap">
                              <Activity className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="font-semibold text-foreground">
                                {paceSecondsToFormatted(paceSeconds)}
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
            disabled={!selectedActivityId || linkStrava.isPending}
          >
            {linkStrava.isPending ? 'Vinculando...' : 'Vincular atividade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

