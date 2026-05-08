import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock, Activity, Link as LinkIcon } from "lucide-react";
import { trainingConfig, trainingTypeColors } from "@/types/training";
import { Card } from "@/components/ui/card";
import { TrainingCheckbox } from "@/components/TrainingCheckbox";
import { CompleteTrainingDialog } from "@/components/CompleteTrainingDialog";
import { TrainingDialog } from "@/components/TrainingDialog";
import { useUpdateTraining } from "@/hooks/useUpdateTraining";
import { metersToKm, paceSecondsToFormatted, secondsToMinutes, secondsToTimeString } from "@/lib/utils";
import { useState, useEffect } from "react";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { UnlinkStravaDialog } from "@/components/UnlinkStravaDialog";

interface DailyTrainingCardProps {
  trainingId?: string;
  date: string;
  type: 'long' | 'recovery' | 'interval' | 'easy';
  title: string;
  description: string | null;
  elapsed_time: number; // seconds
  distance?: number; // meters
  completed?: boolean;
  actual_distance?: number | null; // meters
  actual_elapsed_time?: number | null; // seconds
  pace?: number | null; // seconds per km
  actual_pace?: number | null; // seconds per km
  difficulty_level?: number | null;
  feedbacks?: string | null;
  currentWeekNumber?: number;
  showDate?: boolean;
  onDialogStateChange?: (isOpen: boolean) => void;
  strava_activity_id?: number | null;
  source?: 'plan' | 'manual' | 'strava' | string;
  onOpenManual?: (training: DailyTrainingCardProps) => void;
  onOpenStrava?: (training: DailyTrainingCardProps) => void;
}

export const DailyTrainingCard = ({
  trainingId,
  date,
  type,
  title,
  description,
  elapsed_time,
  distance,
  completed,
  actual_distance,
  actual_elapsed_time,
  pace,
  actual_pace,
  difficulty_level,
  feedbacks,
  currentWeekNumber,
  showDate = true,
  onDialogStateChange,
  strava_activity_id,
  source,
  onOpenManual,
  onOpenStrava,
}: DailyTrainingCardProps) => {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const updateTraining = useUpdateTraining();
  const { user } = useAuth();
  const isManual = source === 'manual';
  const isStrava = source === 'strava';
  const isLinkedToStrava = Boolean(strava_activity_id);
  // Garantir parsing correto da data (adicionar T12:00:00 para evitar mudança de dia por timezone)
  const dateObj = typeof date === 'string'
    ? new Date(date + 'T12:00:00')
    : new Date(date);
  const color = isStrava ? '#e2e8f0' : trainingTypeColors[type];

  const displayTitle = (() => {
    // Atividades importadas do Strava: usar título vindo da atividade
    if (isStrava) {
      return title || trainingConfig[type]?.label || 'Treino';
    }
    // Treinos criados manualmente: usar label do tipo ou título informado
    if (isManual) {
      return trainingConfig[type]?.label || title;
    }
    // Treinos do plano (mesmo vinculados ao Strava): preferir nome/título original do plano
    // Nota: alguns dados trazem name além de title; manter o título do plano se disponível
    return trainingConfig[type]?.label || title;
  })();

  const handleClick = () => {
    // Manual and Strava open their specific dialogs
    if (isManual && onOpenManual) {
      onOpenManual({
        trainingId,
        date,
        type,
        title,
        description,
        elapsed_time,
        distance,
        completed,
        actual_distance,
        actual_elapsed_time,
        pace,
        actual_pace,
        difficulty_level,
        feedbacks,
        currentWeekNumber,
        showDate,
        strava_activity_id,
        source,
      });
      return;
    }

    if (isStrava && onOpenStrava) {
      onOpenStrava({
        trainingId,
        date,
        type,
        title,
        description,
        elapsed_time,
        distance,
        completed,
        actual_distance,
        actual_elapsed_time,
        pace,
        actual_pace,
        difficulty_level,
        feedbacks,
        currentWeekNumber,
        showDate,
        strava_activity_id,
        source,
      });
      return;
    }

    // Plan trainings use existing dialog
    if (trainingId) {
      if (user?.id) {
        track('activity_opened_training_card', user.id, {
          metadata: { trainingId, type },
        });
      }
      setShowTrainingDialog(true);
    }
  };

  const handleTrainingDialogChange = (open: boolean) => {
    setShowTrainingDialog(open);
    // Track when dialog is closed
    if (!open && user?.id && trainingId) {
      track('activity_closed_training_card', user.id, {
        metadata: { trainingId, type },
      });
    }
  };

  const handleCompleteDialogChange = (open: boolean) => {
    setShowCompleteDialog(open);
    // Track when complete dialog is closed
    if (!open && user?.id && trainingId) {
      track('activity_closed_training_card', user.id, {
        metadata: { trainingId, type, dialogType: 'complete' },
      });
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    // Manual and Strava activities are always completed and cannot be toggled
    if (isStrava || isManual) return;

    if (!trainingId) return;

    if (checked) {
      // Abrir dialog para marcar como concluído
      setShowCompleteDialog(true);
    } else {
      // Desmarcar diretamente
      updateTraining.mutate({
        trainingId,
        completed: false
      });
    }
  };

  const handleConfirmComplete = (data: { distance: number; elapsedTime: number; difficultyLevel?: number | null; feedbacks?: string | null }) => {
    if (!trainingId) return;

    const distanceKm = data.distance / 1000;
    updateTraining.mutate({
      trainingId,
      completed: true,
      actualDistance: distanceKm,
      actualElapsedTime: data.elapsedTime,
      difficultyLevel: data.difficultyLevel,
      feedbacks: data.feedbacks
    });

    setShowCompleteDialog(false);
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    return secondsToTimeString(seconds ?? 0);
  };

  const formatPace = (paceSeconds: number | null | undefined): string => {
    if (paceSeconds === null || paceSeconds === undefined) return '';
    return paceSecondsToFormatted(paceSeconds);
  };

  const handleUnlinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUnlinkDialog(true);
  };

  // Notificar pai quando dialogs abrem/fecham
  useEffect(() => {
    if (onDialogStateChange) {
      const isAnyDialogOpen = showCompleteDialog || showTrainingDialog;
      onDialogStateChange(isAnyDialogOpen);
    }
  }, [showCompleteDialog, showTrainingDialog, onDialogStateChange]);

  return (
    <div className="pb-4">
      <Card
        className="relative overflow-hidden border-none shadow-sm rounded-[20px] cursor-pointer hover:shadow-md transition-shadow pb-2"
        onClick={handleClick}
      >
        {/* Barra colorida vertical esquerda */}
        {color && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg"
            style={{ backgroundColor: color }}
          />
        )}

        <div className="pl-6 pr-4 py-4">
          {/* Cabeçalho: apenas data */}
          {showDate && (
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground/70 font-medium uppercase">
                {format(dateObj, "EEE", { locale: ptBR }).substring(0, 3)} - {format(dateObj, "d MMM", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Título do treino */}
          <div className="flex items-start gap-2 mb-3">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-foreground tracking-wide">
                {displayTitle}
              </h3>
            </div>
            <div className="flex gap-2 items-center relative z-20">
              {isManual && (
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#e2e8f0' }}
                >
                  Manual
                </Badge>
              )}
              {isStrava && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1"
                  style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#e2e8f0' }}
                >
                  <LinkIcon className="h-3 w-3" />
                  Strava
                </Badge>
              )}
              {isLinkedToStrava && !isStrava && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 cursor-pointer"
                  style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#e2e8f0' }}
                  onClick={handleUnlinkClick}
                >
                  <LinkIcon className="h-3 w-3" />
                  Strava
                </Badge>
              )}
              {!isStrava && !isManual && (
                <div
                  className="flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TrainingCheckbox
                    checked={completed || false}
                    onCheckedChange={handleCheckboxChange}
                    color={color}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dados do treino */}
          <div className="flex flex-col gap-2 text-sm">
            {/* Distância */}
            {distance !== null && distance !== undefined && (
              <p className="text-muted-foreground flex items-center whitespace-nowrap">
                <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
                {isManual || isStrava ? (
                  <span className="font-black text-foreground font-brand-tertiary">
                    {metersToKm(actual_distance ?? distance).toFixed(1).replace('.', ',')} km
                  </span>
                ) : completed && actual_distance !== null && actual_distance !== undefined ? (
                  <>
                    <span className="font-black text-foreground font-brand-tertiary mr-1">
                      {metersToKm(actual_distance).toFixed(1).replace('.', ',')} km
                    </span>
                    <span>/</span>
                    <span className="text-muted-foreground ml-1 font-brand-tertiary">
                      {metersToKm(distance).toFixed(1).replace('.', ',')} km
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground font-brand-tertiary">
                      {metersToKm(distance).toFixed(1).replace('.', ',')} km
                    </span>
                  </>
                )}
              </p>
            )}

            {/* Duração */}
            <p className="text-muted-foreground flex items-center whitespace-nowrap">
              <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
              {isManual || isStrava ? (
                <span className="font-black text-foreground font-brand-tertiary">
                  {secondsToTimeString(actual_elapsed_time ?? elapsed_time)}
                </span>
              ) : completed && actual_elapsed_time !== null && actual_elapsed_time !== undefined ? (
                <>
                  <span className="font-black text-foreground font-brand-tertiary mr-1">
                    {secondsToTimeString(actual_elapsed_time)}
                  </span>
                  <span>/</span>
                  <span className="text-muted-foreground ml-1 font-brand-tertiary">{formatDuration(elapsed_time)}</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground font-brand-tertiary">{formatDuration(elapsed_time)}</span>
                </>
              )}
            </p>

            {/* Pace */}
            {pace !== null && pace !== undefined && (
              <p className="text-muted-foreground flex items-center whitespace-nowrap">
                <Activity className="w-5 h-5 mr-3 flex-shrink-0" />
                {isManual || isStrava ? (
                  <span className="font-black text-foreground font-brand-tertiary">{formatPace(actual_pace ?? pace)}</span>
                ) : completed && actual_pace !== null && actual_pace !== undefined ? (
                  <>
                    <span className="font-black text-foreground font-brand-tertiary mr-1">{formatPace(actual_pace)}</span>
                    <span>/</span>
                    <span className="text-muted-foreground ml-1 font-brand-tertiary">{formatPace(pace)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground font-brand-tertiary">{formatPace(pace)}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </Card>

      <CompleteTrainingDialog
        open={showCompleteDialog}
        onOpenChange={handleCompleteDialogChange}
        training={{
          distance: distance || 0,
          elapsed_time
        }}
        onConfirm={handleConfirmComplete}
      />

      {trainingId && description && (
        <TrainingDialog
          open={showTrainingDialog}
          onOpenChange={handleTrainingDialogChange}
          training={{
            id: trainingId,
            date,
            type,
            title,
            description,
            distance: distance || 0,
            elapsed_time,
            pace,
            completed,
            actual_distance,
            actual_elapsed_time,
            actual_pace,
            difficulty_level,
            feedbacks,
            strava_activity_id
          }}
        />
      )}

      {trainingId && isLinkedToStrava && (
        <UnlinkStravaDialog
          open={showUnlinkDialog}
          onOpenChange={setShowUnlinkDialog}
          trainingId={trainingId}
        />
      )}
    </div>
  );
};
