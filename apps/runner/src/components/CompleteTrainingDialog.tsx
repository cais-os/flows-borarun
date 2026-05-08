import { useEffect, useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MdSentimentVerySatisfied,
  MdSentimentSatisfied,
  MdSentimentNeutral,
  MdSentimentDissatisfied,
  MdSentimentVeryDissatisfied
} from 'react-icons/md';
import { metersToKm, paceSecondsToFormatted, secondsToMinutes } from '@/lib/utils';

const completeTrainingSchema = z.object({
  distance: z.coerce
    .number()
    .min(0.1, 'Distância deve ser maior que 0')
    .max(100, 'Distância muito alta'),
  time: z.coerce
    .number()
    .min(1, 'Tempo deve ser maior que 0')
    .max(500, 'Tempo muito alto'),
  difficultyLevel: z.union([
    z.number().min(1).max(5),
    z.null()
  ]).optional(),
  feedbacks: z.string().optional(),
});

type CompleteTrainingForm = z.infer<typeof completeTrainingSchema>;

interface CompleteTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: {
    distance: number; // meters
    elapsed_time: number; // seconds
  };
  onConfirm: (data: { distance: number; elapsedTime: number; difficultyLevel?: number | null; feedbacks?: string | null }) => void;
  initialValues?: {
    distance?: number; // meters
    time?: number; // seconds
    difficultyLevel?: number | null;
    feedbacks?: string | null;
  };
}

const difficultyConfig = [
  { level: 1, color: "#7acc16", label: "Muito fácil", Icon: MdSentimentVerySatisfied },
  { level: 2, color: "#d1d016", label: "Fácil", Icon: MdSentimentSatisfied },
  { level: 3, color: "#f59e0b", label: "Normal", Icon: MdSentimentNeutral },
  { level: 4, color: "#f97316", label: "Difícil", Icon: MdSentimentDissatisfied },
  { level: 5, color: "#ef4444", label: "Muito difícil", Icon: MdSentimentVeryDissatisfied }
];

export const CompleteTrainingDialog = ({
  open,
  onOpenChange,
  training,
  onConfirm,
  initialValues,
}: CompleteTrainingDialogProps) => {
  const [selectedDifficultyLevel, setSelectedDifficultyLevel] = useState<number | null>(initialValues?.difficultyLevel ?? null);
  const [distanceInput, setDistanceInput] = useState<string>('');
  const [timeInput, setTimeInput] = useState<string>('');
  const prevOpenRef = useRef(open);

  // Função para converter formato MM:SS ou MM,SS para minutos decimais
  const parseTimeInput = (value: string, strict: boolean = false): number | null => {
    if (!value || value.trim() === '') return null;

    // Remove espaços
    const cleaned = value.trim();

    // Verifica se tem formato MM:SS ou MM,SS
    const colonIndex = cleaned.indexOf(':');
    const commaIndex = cleaned.indexOf(',');

    if (colonIndex !== -1 || commaIndex !== -1) {
      // Formato MM:SS ou MM,SS
      const separatorIndex = colonIndex !== -1 ? colonIndex : commaIndex;
      const minutesStr = cleaned.substring(0, separatorIndex);
      const secondsStr = cleaned.substring(separatorIndex + 1);

      // Se não tem minutos antes do separador, não é válido
      if (minutesStr === '') return null;

      const minutes = parseFloat(minutesStr);

      // Se minutos é inválido ou negativo, retorna null
      if (isNaN(minutes) || minutes < 0) {
        return null;
      }

      // Se não tem segundos após o separador, trata como apenas minutos (durante digitação)
      if (secondsStr === '') {
        return minutes;
      }

      // Interpretar segundos: 1 dígito = dezena, 2+ dígitos = segundos exatos
      let seconds: number;
      const secondsDigits = secondsStr.replace(/[^0-9]/g, ''); // Remove caracteres não numéricos

      if (secondsDigits.length === 1) {
        // Um dígito = dezena de segundos (ex: "1" = 10 segundos)
        seconds = parseInt(secondsDigits, 10) * 10;
      } else if (secondsDigits.length >= 2) {
        // Dois ou mais dígitos = segundos exatos (pegar apenas os 2 primeiros)
        seconds = parseInt(secondsDigits.substring(0, 2), 10);
      } else {
        seconds = 0;
      }

      // Validação básica de segundos
      if (isNaN(seconds) || seconds < 0) {
        return null;
      }

      // Validação estrita de segundos (apenas no blur)
      if (strict && seconds >= 60) {
        return null;
      }

      // Converte para minutos decimais
      // Se segundos >= 60, trata como minutos extras (ex: 16,70 = 16 min + 70 seg = 17 min 10 seg)
      if (seconds >= 60) {
        const extraMinutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return minutes + extraMinutes + (remainingSeconds / 60);
      }

      return minutes + (seconds / 60);
    } else {
      // Formato decimal simples (minutos)
      const numValue = parseFloat(cleaned.replace(',', '.'));
      if (isNaN(numValue) || numValue < 0) return null;
      return numValue;
    }
  };

  // Função para formatar minutos decimais para exibição MM:SS (sempre com segundos)
  const formatTimeForDisplay = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '';

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue < 0) return '';

    const minutes = Math.floor(numValue);
    const seconds = Math.round((numValue - minutes) * 60);

    // Sempre retorna no formato MM:SS
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CompleteTrainingForm>({
    resolver: zodResolver(completeTrainingSchema),
    defaultValues: {
      distance: metersToKm(initialValues?.distance ?? training.distance),
      time: secondsToMinutes(initialValues?.time ?? training.elapsed_time),
      difficultyLevel: initialValues?.difficultyLevel ?? null,
      feedbacks: initialValues?.feedbacks ?? '',
    },
  });

  // Reset form apenas quando o dialog abre (transição de false para true)
  useEffect(() => {
    const wasClosed = !prevOpenRef.current;
    const isNowOpen = open;

    if (wasClosed && isNowOpen) {
      const distance = metersToKm(initialValues?.distance ?? training.distance);
      const time = secondsToMinutes(initialValues?.time ?? training.elapsed_time);
      const difficultyLevel = initialValues?.difficultyLevel ?? null;
      const feedbacks = initialValues?.feedbacks ?? '';

      reset({
        distance,
        time,
        difficultyLevel,
        feedbacks,
      });
      setSelectedDifficultyLevel(difficultyLevel);
      // Sincronizar inputs locais
      setDistanceInput(distance !== undefined && distance !== null ? String(distance) : '');
      setTimeInput(formatTimeForDisplay(time));
    }

    prevOpenRef.current = open;
  }, [open, reset, initialValues, training]);

  const distance = watch('distance');
  const time = watch('time');

  let calculatedPace = '--:--/km';
  try {
    if (distance && time && Number(time) > 0 && Number(distance) > 0) {
      const paceSeconds = (Number(time) * 60) / Number(distance);
      calculatedPace = paceSecondsToFormatted(paceSeconds);
    }
  } catch (e) {
    // Invalid calculation, keep default
  }

  const handleDifficultyLevelChange = (level: number, currentValue: number | null) => {
    // Toggle: se já está selecionado, deseleciona
    const newValue = currentValue === level ? null : level;
    setSelectedDifficultyLevel(newValue);
    setValue('difficultyLevel', newValue);
  };


  const onSubmit = (data: CompleteTrainingForm) => {
    const distanceMeters = Math.round(data.distance * 1000);
    const elapsedSeconds = Math.round(data.time * 60);
    onConfirm({
      distance: distanceMeters,
      elapsedTime: elapsedSeconds,
      difficultyLevel: data.difficultyLevel || null,
      feedbacks: data.feedbacks || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md rounded-[20px] max-w-[calc(100%-2rem)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{initialValues ? 'Editar treino realizado' : 'Registrar treino realizado'}</DialogTitle>
          <DialogDescription>
            {initialValues ? 'Edite os dados do treino que você completou' : 'Preencha os dados do treino que você completou'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="distance">Distância <span className="text-muted-foreground">(km)</span></Label>
            <Controller
              name="distance"
              control={control}
              render={({ field }) => (
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  placeholder="5.0"
                  value={distanceInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Permitir campo completamente vazio durante digitação
                    setDistanceInput(value);
                    // Atualizar o form apenas se tiver valor válido
                    if (value === '') {
                      field.onChange(undefined);
                    } else {
                      const numValue = Number(value);
                      if (!isNaN(numValue) && numValue > 0) {
                        field.onChange(numValue);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    field.onBlur();
                    // Garantir que o input local está sincronizado com o valor do form
                    const currentValue = field.value;
                    if (currentValue !== undefined && currentValue !== null && distanceInput === '') {
                      setDistanceInput(String(currentValue));
                    }
                  }}
                  className="bg-white"
                />
              )}
            />
            {errors.distance && (
              <p className="text-sm text-destructive">{errors.distance.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="time">Tempo <span className="text-muted-foreground">(min:ss)</span></Label>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="time"
                      type="text"
                      placeholder="00:00"
                      value={timeInput}
                      onChange={(e) => {
                        const value = e.target.value;

                        // Permitir campo completamente vazio
                        if (value === '') {
                          setTimeInput('');
                          field.onChange(undefined);
                          return;
                        }

                        // Aceitar apenas números, dois pontos, vírgula e ponto
                        // Permitir que o usuário digite livremente durante a escrita
                        const sanitized = value.replace(/[^0-9:.,]/g, '');

                        // Atualizar o input com o valor sanitizado (sem formatar)
                        setTimeInput(sanitized);

                        // Tentar converter para minutos decimais (sem formatar a exibição)
                        const timeInMinutes = parseTimeInput(sanitized);
                        if (timeInMinutes !== null && timeInMinutes > 0) {
                          field.onChange(timeInMinutes);
                        } else {
                          field.onChange(undefined);
                        }
                      }}
                      onBlur={(e) => {
                        field.onBlur();

                        // Se o campo está vazio, manter vazio
                        if (timeInput === '') {
                          return;
                        }

                        // Tentar parsear o valor digitado
                        const timeInMinutes = parseTimeInput(timeInput, true);

                        if (timeInMinutes !== null && timeInMinutes > 0) {
                          // Formatar para exibição MM:SS
                          setTimeInput(formatTimeForDisplay(timeInMinutes));
                          field.onChange(timeInMinutes);
                        } else {
                          // Se não conseguiu parsear, verificar se há valor no form
                          const currentValue = field.value;
                          if (currentValue !== undefined && currentValue !== null) {
                            // Formatar o valor do form
                            setTimeInput(formatTimeForDisplay(currentValue));
                          } else {
                            // Limpar se não há valor válido
                            setTimeInput('');
                          }
                        }
                      }}
                      className="bg-white"
                    />
                  )}
                />
                {errors.time && (
                  <p className="text-sm text-destructive">{errors.time.message}</p>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label>Pace</Label>
                <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center text-muted-foreground font-brand-tertiary">
                  {calculatedPace}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <Label className="text-sm font-brand-tertiary text-foreground">
              Dificuldade <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Controller
              name="difficultyLevel"
              control={control}
              render={({ field }) => {
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {difficultyConfig.map(({ level, label }) => {
                        const isSelected = field.value === level;
                        return (
                          <div key={level} className="flex flex-col items-center gap-2 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                const newValue = field.value === level ? null : level;
                                handleDifficultyLevelChange(level, field.value);
                                field.onChange(newValue);
                              }}
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
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedbacks">Feedbacks <span className="text-muted-foreground">(opcional)</span></Label>
            <Controller
              name="feedbacks"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="feedbacks"
                  placeholder="Adicione seus comentários sobre o treino..."
                  className="min-h-[80px] resize-none font-brand-tertiary text-base bg-white"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
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
            <Button type="submit" className="flex-1 font-brand-primary tracking-wide font-semibold">
              CONFIRMAR
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
