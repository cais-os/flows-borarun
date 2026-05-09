import { useState } from "react";
import {
  MdSentimentDissatisfied,
  MdSentimentNeutral,
  MdSentimentSatisfied,
  MdSentimentVeryDissatisfied,
  MdSentimentVerySatisfied,
} from "react-icons/md";
import { Activity, Clock, MapPin } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompleteTrainingDialog } from "@/components/CompleteTrainingDialog";
import { TrainingCheckbox } from "@/components/TrainingCheckbox";
import { metersToKm, paceSecondsToFormatted, secondsToTimeString } from "@/lib/utils";
import { trainingTypeColors } from "@/types/training";

interface PublicTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isUpdating?: boolean;
  onCompletionChange?: (checked: boolean) => void;
  onCompleteTraining?: (data: {
    distance: number;
    elapsedTime: number;
    difficultyLevel?: number | null;
    feedbacks?: string | null;
  }) => void;
  training: {
    id: string;
    date: string;
    type: "long" | "recovery" | "interval" | "easy";
    title: string;
    description: string | null;
    distance: number;
    elapsed_time: number;
    pace?: number | null;
    completed?: boolean;
    actual_distance?: number | null;
    actual_elapsed_time?: number | null;
    actual_pace?: number | null;
    difficulty_level?: number | null;
    feedbacks?: string | null;
  };
}

const difficultyConfig = [
  { level: 1, label: "Muito facil", Icon: MdSentimentVerySatisfied },
  { level: 2, label: "Facil", Icon: MdSentimentSatisfied },
  { level: 3, label: "Normal", Icon: MdSentimentNeutral },
  { level: 4, label: "Dificil", Icon: MdSentimentDissatisfied },
  { level: 5, label: "Muito dificil", Icon: MdSentimentVeryDissatisfied },
];

function formatDuration(seconds: number) {
  return secondsToTimeString(seconds);
}

export function PublicTrainingDialog({
  open,
  onOpenChange,
  training,
  isUpdating = false,
  onCompletionChange,
  onCompleteTraining,
}: PublicTrainingDialogProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const color = trainingTypeColors[training.type];

  const handleToggleComplete = () => {
    setShowCompleteDialog(true);
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (!checked && training.completed) {
      onCompletionChange?.(false);
      return;
    }

    if (checked && !training.completed) {
      setShowCompleteDialog(true);
    }
  };

  const handleConfirmComplete = (data: {
    distance: number;
    elapsedTime: number;
    difficultyLevel?: number | null;
    feedbacks?: string | null;
  }) => {
    onCompleteTraining?.(data);
    setShowCompleteDialog(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] px-4 pb-6">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center justify-between gap-2 text-2xl font-bold tracking-wide">
              {training.title}
              {training.completed && (
                <div onClick={(event) => event.stopPropagation()} className="ml-auto">
                  <TrainingCheckbox
                    checked={training.completed || false}
                    onCheckedChange={handleCheckboxChange}
                    color={color}
                  />
                </div>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 overflow-y-auto px-4 pb-4">
            <Card className="relative overflow-hidden rounded-[20px] border-none shadow-sm">
              <div
                className="absolute bottom-0 left-0 top-0 w-2 rounded-l-lg"
                style={{ backgroundColor: color }}
              />

              <div className="py-4 pl-6 pr-4">
                <div className="flex flex-col gap-2 font-brand-tertiary text-sm">
                  {training.distance ? (
                    <p className="flex items-center whitespace-nowrap text-muted-foreground">
                      <MapPin className="mr-3 h-5 w-5 flex-shrink-0" />
                      {training.completed && training.actual_distance ? (
                        <>
                          <span className="mr-1 font-semibold text-foreground">
                            {metersToKm(training.actual_distance).toFixed(1).replace(".", ",")} km
                          </span>
                          <span>/</span>
                          <span className="ml-1 text-muted-foreground">
                            {metersToKm(training.distance).toFixed(1).replace(".", ",")} km
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {metersToKm(training.distance).toFixed(1).replace(".", ",")} km
                        </span>
                      )}
                    </p>
                  ) : null}

                  <p className="flex items-center whitespace-nowrap text-muted-foreground">
                    <Clock className="mr-3 h-5 w-5 flex-shrink-0" />
                    {training.completed && training.actual_elapsed_time ? (
                      <>
                        <span className="mr-1 font-semibold text-foreground">
                          {secondsToTimeString(training.actual_elapsed_time)}
                        </span>
                        <span>/</span>
                        <span className="ml-1 text-muted-foreground">
                          {formatDuration(training.elapsed_time)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatDuration(training.elapsed_time)}
                      </span>
                    )}
                  </p>

                  {training.pace !== undefined && training.pace !== null && (
                    <p className="flex items-center whitespace-nowrap text-muted-foreground">
                      <Activity className="mr-3 h-5 w-5 flex-shrink-0" />
                      {training.completed && training.actual_pace ? (
                        <>
                          <span className="mr-1 font-semibold text-foreground">
                            {paceSecondsToFormatted(training.actual_pace)}
                          </span>
                          <span>/</span>
                          <span className="ml-1 text-muted-foreground">
                            {paceSecondsToFormatted(training.pace)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {paceSecondsToFormatted(training.pace)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {training.description && (
              <Card className="relative mb-4 overflow-visible rounded-[20px] border-none shadow-sm">
                <div className="px-5 py-4">
                  <h2 className="mb-3 text-lg font-bold tracking-wide text-foreground">
                    Descricao do Treino
                  </h2>
                  <div className="space-y-2">
                    {training.description.split("\n").map((line, index) => {
                      const trimmedLine = line.trim();
                      if (!trimmedLine) return null;

                      if (trimmedLine.startsWith("-")) {
                        return (
                          <div key={`${trimmedLine}-${index}`} className="flex items-start gap-2">
                            <span className="mt-0.5 text-black">-</span>
                            <span className="flex-1 font-brand-tertiary text-sm font-normal leading-relaxed text-black">
                              {trimmedLine.replace(/^-+\s*/, "")}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <p
                          key={`${trimmedLine}-${index}`}
                          className="font-brand-tertiary text-sm font-semibold leading-relaxed text-black"
                        >
                          {trimmedLine}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {training.completed && training.difficulty_level && (
              <Card className="relative mb-4 overflow-visible rounded-[20px] border-none shadow-sm">
                <div className="px-5 py-4">
                  <h2 className="mb-3 text-lg font-bold tracking-wide text-foreground">
                    Dificuldade Registrada
                  </h2>
                  <div className="flex gap-2">
                    {difficultyConfig.map(({ level, label, Icon }) =>
                      level === training.difficulty_level ? (
                        <span
                          key={level}
                          className="flex items-center gap-2 font-brand-tertiary text-sm leading-relaxed text-black"
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              </Card>
            )}

            {training.completed && training.feedbacks && (
              <Card className="relative mb-4 overflow-visible rounded-[20px] border-none shadow-sm">
                <div className="px-5 py-4">
                  <h2 className="mb-3 text-lg font-bold tracking-wide text-foreground">
                    Feedbacks para o Treinador
                  </h2>
                  <p className="whitespace-pre-wrap font-brand-tertiary text-sm leading-relaxed text-black">
                    {training.feedbacks}
                  </p>
                </div>
              </Card>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleToggleComplete}
                disabled={isUpdating}
                className="h-12 w-full rounded-xl font-brand-primary font-semibold uppercase tracking-wide text-black transition-all hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                {isUpdating ? "SALVANDO..." : training.completed ? "EDITAR TREINO" : "REGISTRAR TREINO"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <CompleteTrainingDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        training={{
          distance: training.distance,
          elapsed_time: training.elapsed_time,
        }}
        onConfirm={handleConfirmComplete}
        initialValues={
          training.completed
            ? {
                distance: training.actual_distance ? Number(training.actual_distance) : undefined,
                time: training.actual_elapsed_time ?? undefined,
                difficultyLevel: training.difficulty_level ?? null,
                feedbacks: training.feedbacks ?? null,
              }
            : undefined
        }
      />
    </>
  );
}
