import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateManualTraining } from "@/hooks/useCreateManualTraining";
import { toast } from "@/hooks/use-toast";
import { useUpdateManualTraining } from "@/hooks/useUpdateManualTraining";
import { ManualTraining } from "@/types/training";
import { paceSecondsToFormatted } from "@/lib/utils";

interface CreateManualTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  mode?: 'create' | 'edit';
  initialTraining?: Partial<ManualTraining>;
}

const TRAINING_TYPES = [
  { value: "long", label: "Longão" },
  { value: "recovery", label: "Regenerativo" },
  { value: "interval", label: "Intervalado" },
  { value: "easy", label: "Ritmo" },
];

export const CreateManualTrainingDialog = ({ open, onOpenChange, date, mode = 'create', initialTraining }: CreateManualTrainingDialogProps) => {
  const createTraining = useCreateManualTraining();
  const updateTraining = useUpdateManualTraining();
  const [type, setType] = useState<string>("easy");
  const [distanceInput, setDistanceInput] = useState<string>("");
  const [timeInput, setTimeInput] = useState<string>("");
  const [difficultyLevel, setDifficultyLevel] = useState<number | null>(null);
  const [feedbacks, setFeedbacks] = useState<string>("");
  const prevOpenRef = useRef(open);

  const dateString = initialTraining?.date || date.toISOString().split("T")[0];

  const parseTimeInput = (value: string, strict: boolean = false): number | null => {
    if (!value || value.trim() === '') return null;

    const cleaned = value.trim();
    const colonIndex = cleaned.indexOf(':');
    const commaIndex = cleaned.indexOf(',');

    if (colonIndex !== -1 || commaIndex !== -1) {
      const separatorIndex = colonIndex !== -1 ? colonIndex : commaIndex;
      const minutesStr = cleaned.substring(0, separatorIndex);
      const secondsStr = cleaned.substring(separatorIndex + 1);
      if (minutesStr === '') return null;

      const minutes = parseFloat(minutesStr);
      if (isNaN(minutes) || minutes < 0) return null;

      if (secondsStr === '') return minutes;

      const secondsDigits = secondsStr.replace(/[^0-9]/g, '');
      let seconds: number;
      if (secondsDigits.length === 1) {
        seconds = parseInt(secondsDigits, 10) * 10;
      } else if (secondsDigits.length >= 2) {
        seconds = parseInt(secondsDigits.substring(0, 2), 10);
      } else {
        seconds = 0;
      }

      if (isNaN(seconds) || seconds < 0) return null;
      if (strict && seconds >= 60) return null;

      if (seconds >= 60) {
        const extraMinutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return minutes + extraMinutes + (remainingSeconds / 60);
      }

      return minutes + (seconds / 60);
    } else {
      const numValue = parseFloat(cleaned.replace(',', '.'));
      if (isNaN(numValue) || numValue < 0) return null;
      return numValue;
    }
  };

  const formatTimeForDisplay = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue < 0) return '';
    const minutes = Math.floor(numValue);
    const seconds = Math.round((numValue - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Pace calculation for display (seconds per km to formatted)
  const calculatedPaceSeconds = (() => {
    const distanceNum = parseFloat(distanceInput.replace(',', '.'));
    const timeMinutes = parseTimeInput(timeInput);
    if (!timeMinutes || !distanceNum || distanceNum <= 0) return null;
    const elapsedSeconds = Math.round(timeMinutes * 60);
    return Math.round(elapsedSeconds / distanceNum);
  })();

  useEffect(() => {
    const wasClosed = !prevOpenRef.current;
    const isNowOpen = open;

    if (wasClosed && isNowOpen) {
      setType((initialTraining?.type as string) || "easy");
      const baseDistance = initialTraining?.actual_distance ?? initialTraining?.distance ?? 0;
      setDistanceInput(baseDistance ? String(baseDistance / 1000) : "");
      const baseElapsed = initialTraining?.actual_elapsed_time ?? initialTraining?.elapsed_time ?? 0;
      setTimeInput(baseElapsed ? formatTimeForDisplay(baseElapsed / 60) : "");
      setDifficultyLevel(initialTraining?.difficulty_level ?? null);
      setFeedbacks(initialTraining?.feedbacks ?? "");
    }
    prevOpenRef.current = open;
  }, [date, open, initialTraining]);

  const handleSubmit = () => {
    const distance = parseFloat(distanceInput.replace(',', '.'));
    const timeMinutes = parseTimeInput(timeInput, true);

    if (Number.isNaN(distance) || distance <= 0) {
      toast({ title: "Informe uma distância válida", variant: "destructive" });
      return;
    }
    if (timeMinutes === null || Number.isNaN(timeMinutes) || timeMinutes <= 0) {
      toast({ title: "Informe uma duração válida", variant: "destructive" });
      return;
    }

    const elapsedSeconds = Math.round(timeMinutes * 60);
    const paceSeconds = Math.round(elapsedSeconds / distance);

    if (mode === 'edit' && initialTraining?.id) {
      updateTraining.mutate(
        {
          id: initialTraining.id,
          date: dateString,
          type,
          distanceKm: distance,
          elapsedTimeSeconds: elapsedSeconds,
          paceSeconds,
          difficulty_level: difficultyLevel,
          feedbacks,
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      createTraining.mutate(
        {
          date: dateString,
          type,
          distanceKm: distance,
          elapsedTimeSeconds: elapsedSeconds,
          paceSeconds,
          difficulty_level: difficultyLevel,
          feedbacks,
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md rounded-[20px] max-w-[calc(100%-2rem)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar treino manual' : 'Novo treino manual'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? 'Edite os dados do treino manual' : 'Preencha os dados do treino manual'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-white font-brand-tertiary">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="font-brand-tertiary">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Distância (km)</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={distanceInput}
              onChange={(e) => setDistanceInput(e.target.value)}
              className="bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Tempo (min:ss)</Label>
              <Input
                type="text"
                placeholder="00:00"
                value={timeInput}
                onChange={(e) => {
                  const value = e.target.value;
                  // allow only numbers, colon, comma
                  const sanitized = value.replace(/[^0-9:.,]/g, "");
                  setTimeInput(sanitized);
                }}
                onBlur={() => {
                  const timeMinutes = parseTimeInput(timeInput, true);
                  if (timeMinutes !== null && timeMinutes > 0) {
                    setTimeInput(formatTimeForDisplay(timeMinutes));
                  }
                }}
                className="bg-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Pace</Label>
              <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center text-muted-foreground font-brand-tertiary">
                {calculatedPaceSeconds ? paceSecondsToFormatted(calculatedPaceSeconds) : "--:--/km"}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <Label className="text-sm font-brand-tertiary text-foreground">
              Dificuldade <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const isSelected = difficultyLevel === level;
                  return (
                    <div key={level} className="flex flex-col items-center gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => setDifficultyLevel(isSelected ? null : level)}
                        className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center font-bold text-sm border-2
                          ${isSelected
                            ? 'bg-primary text-black border-primary shadow-lg scale-110'
                            : 'bg-white text-black border-muted-foreground/30 hover:border-muted-foreground/50 hover:scale-105'
                          }
                        `}
                      >
                        {level}
                      </button>
                      <span className="text-[10px] font-brand-tertiary text-muted-foreground text-center font-semibold leading-tight whitespace-nowrap">
                        {level === 1 && "Muito fácil"}
                        {level === 2 && "Fácil"}
                        {level === 3 && "Normal"}
                        {level === 4 && "Difícil"}
                        {level === 5 && "Muito difícil"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedbacks">Feedbacks <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea
              id="feedbacks"
              placeholder="Adicione seus comentários sobre o treino..."
              className="min-h-[80px] resize-none font-brand-tertiary text-base bg-white"
              value={feedbacks}
              onChange={(e) => setFeedbacks(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 font-brand-primary tracking-wide font-semibold"
            onClick={() => onOpenChange(false)}
          >
            CANCELAR
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mode === 'edit' ? updateTraining.isPending : createTraining.isPending}
            className="flex-1 font-brand-primary tracking-wide font-semibold"
          >
            {mode === 'edit'
              ? (updateTraining.isPending ? "CONFIRMANDO..." : "CONFIRMAR")
              : (createTraining.isPending ? "CONFIRMANDO..." : "CONFIRMAR")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

