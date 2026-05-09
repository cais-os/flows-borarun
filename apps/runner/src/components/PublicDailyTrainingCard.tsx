import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CompleteTrainingDialog } from "@/components/CompleteTrainingDialog";
import { TrainingCheckbox } from "@/components/TrainingCheckbox";
import { metersToKm, paceSecondsToFormatted, secondsToTimeString } from "@/lib/utils";
import { trainingConfig, trainingTypeColors } from "@/types/training";

export interface PublicDailyTrainingCardProps {
  trainingId?: string;
  date: string;
  type: "long" | "recovery" | "interval" | "easy";
  title: string;
  description: string | null;
  elapsed_time: number;
  distance?: number;
  completed?: boolean;
  actual_distance?: number | null;
  actual_elapsed_time?: number | null;
  pace?: number | null;
  actual_pace?: number | null;
  difficulty_level?: number | null;
  feedbacks?: string | null;
  currentWeekNumber?: number;
  showDate?: boolean;
  onOpenPlan?: (training: PublicDailyTrainingCardProps) => void;
  onTogglePlanComplete?: (training: PublicDailyTrainingCardProps, checked: boolean) => void;
  onCompletePlanTraining?: (
    training: PublicDailyTrainingCardProps,
    data: {
      distance: number;
      elapsedTime: number;
      difficultyLevel?: number | null;
      feedbacks?: string | null;
    }
  ) => void;
}

export function PublicDailyTrainingCard({
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
  onOpenPlan,
  onTogglePlanComplete,
  onCompletePlanTraining,
}: PublicDailyTrainingCardProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const dateObj = typeof date === "string" ? new Date(`${date}T12:00:00`) : new Date(date);
  const color = trainingTypeColors[type];
  const displayTitle = trainingConfig[type]?.label || title;
  const trainingPayload: PublicDailyTrainingCardProps = {
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
  };

  const handleClick = () => {
    onOpenPlan?.(trainingPayload);
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (!trainingId) return;

    if (checked) {
      setShowCompleteDialog(true);
      return;
    }

    onTogglePlanComplete?.(trainingPayload, false);
  };

  const handleConfirmComplete = (data: {
    distance: number;
    elapsedTime: number;
    difficultyLevel?: number | null;
    feedbacks?: string | null;
  }) => {
    if (!trainingId) return;

    onCompletePlanTraining?.(trainingPayload, data);
    setShowCompleteDialog(false);
  };

  const formatPace = (paceSeconds: number | null | undefined) => {
    if (paceSeconds === null || paceSeconds === undefined) return "";
    return paceSecondsToFormatted(paceSeconds);
  };

  return (
    <div className="pb-4">
      <Card
        className="relative cursor-pointer overflow-hidden rounded-[20px] border-none pb-2 shadow-sm transition-shadow hover:shadow-md"
        onClick={handleClick}
      >
        <div
          className="absolute bottom-0 left-0 top-0 w-2 rounded-l-lg"
          style={{ backgroundColor: color }}
        />

        <div className="py-4 pl-6 pr-4">
          {showDate && (
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-medium uppercase text-muted-foreground/70">
                {format(dateObj, "EEE", { locale: ptBR }).substring(0, 3)} -{" "}
                {format(dateObj, "d MMM", { locale: ptBR })}
              </p>
            </div>
          )}

          <div className="mb-3 flex items-start gap-2">
            <div className="flex-1">
              <h3 className="text-2xl font-bold tracking-wide text-foreground">
                {displayTitle}
              </h3>
            </div>
            <div className="relative z-20 flex items-center gap-2">
              <div
                className="flex items-center"
                onClick={(event) => event.stopPropagation()}
              >
                <TrainingCheckbox
                  checked={completed || false}
                  onCheckedChange={handleCheckboxChange}
                  color={color}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            {distance !== null && distance !== undefined && (
              <p className="flex items-center whitespace-nowrap text-muted-foreground">
                <MapPin className="mr-3 h-5 w-5 flex-shrink-0" />
                {completed && actual_distance !== null && actual_distance !== undefined ? (
                  <>
                    <span className="mr-1 font-brand-tertiary font-black text-foreground">
                      {metersToKm(actual_distance).toFixed(1).replace(".", ",")} km
                    </span>
                    <span>/</span>
                    <span className="ml-1 font-brand-tertiary text-muted-foreground">
                      {metersToKm(distance).toFixed(1).replace(".", ",")} km
                    </span>
                  </>
                ) : (
                  <span className="font-brand-tertiary text-muted-foreground">
                    {metersToKm(distance).toFixed(1).replace(".", ",")} km
                  </span>
                )}
              </p>
            )}

            <p className="flex items-center whitespace-nowrap text-muted-foreground">
              <Clock className="mr-3 h-5 w-5 flex-shrink-0" />
              {completed && actual_elapsed_time !== null && actual_elapsed_time !== undefined ? (
                <>
                  <span className="mr-1 font-brand-tertiary font-black text-foreground">
                    {secondsToTimeString(actual_elapsed_time)}
                  </span>
                  <span>/</span>
                  <span className="ml-1 font-brand-tertiary text-muted-foreground">
                    {secondsToTimeString(elapsed_time)}
                  </span>
                </>
              ) : (
                <span className="font-brand-tertiary text-muted-foreground">
                  {secondsToTimeString(elapsed_time)}
                </span>
              )}
            </p>

            {pace !== null && pace !== undefined && (
              <p className="flex items-center whitespace-nowrap text-muted-foreground">
                <Activity className="mr-3 h-5 w-5 flex-shrink-0" />
                {completed && actual_pace !== null && actual_pace !== undefined ? (
                  <>
                    <span className="mr-1 font-brand-tertiary font-black text-foreground">
                      {formatPace(actual_pace)}
                    </span>
                    <span>/</span>
                    <span className="ml-1 font-brand-tertiary text-muted-foreground">
                      {formatPace(pace)}
                    </span>
                  </>
                ) : (
                  <span className="font-brand-tertiary text-muted-foreground">
                    {formatPace(pace)}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </Card>

      <CompleteTrainingDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        training={{
          distance: distance || 0,
          elapsed_time,
        }}
        onConfirm={handleConfirmComplete}
      />
    </div>
  );
}
