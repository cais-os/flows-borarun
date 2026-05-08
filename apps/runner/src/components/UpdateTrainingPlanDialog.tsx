import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TrainingPlan } from '@/hooks/useTrainingPlan';
import type { RegenerateTrainingPlanOptions } from '@/hooks/useRegenerateTrainingPlan';
import { Card } from '@/components/ui/card';

interface UpdateTrainingPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingPlan: TrainingPlan | null;
  onConfirm: (options: RegenerateTrainingPlanOptions) => void;
  isLoading?: boolean;
}

export const UpdateTrainingPlanDialog = ({
  open,
  onOpenChange,
  trainingPlan,
  onConfirm,
  isLoading = false,
}: UpdateTrainingPlanDialogProps) => {
  const [goalDistance, setGoalDistance] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [displayMonth, setDisplayMonth] = useState<Date | undefined>(undefined);
  const [showModifyGoals, setShowModifyGoals] = useState<boolean>(false);
  const [showModifyAvailability, setShowModifyAvailability] = useState<boolean>(false);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [desiredWeeklyDays, setDesiredWeeklyDays] = useState<number>(0);
  const [longRunDays, setLongRunDays] = useState<string[]>([]);

  // Initialize form values from trainingPlan
  useEffect(() => {
    if (open && trainingPlan) {
      setGoalDistance(trainingPlan.goal_distance);
      setTargetDate(trainingPlan.race_date ? parseISO(trainingPlan.race_date) : null);
      setTotalWeeks(trainingPlan.total_weeks);
      setFeedback('');
      setDisplayMonth(trainingPlan.race_date ? parseISO(trainingPlan.race_date) : undefined);
      setShowModifyGoals(false);
      setShowModifyAvailability(false);
      setAvailableDays([]);
      setDesiredWeeklyDays(0);
      setLongRunDays([]);
    }
  }, [open, trainingPlan]);

  // IMPORTANTE: Esta função só é chamada quando o usuário clica explicitamente no botão "Atualizar Plano"
  // Fecha o dialog imediatamente e dispara a função de regeneração
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar disponibilidade se o toggle estiver ativado
    if (showModifyAvailability) {
      if (availableDays.length === 0) {
        return; // Não permitir submit sem dias selecionados
      }
      if (desiredWeeklyDays === 0 || desiredWeeklyDays > availableDays.length) {
        return; // Não permitir submit sem dias por semana válidos
      }
    }

    const options: RegenerateTrainingPlanOptions = {
      allow_goal_modification: true,
      new_goal_distance: goalDistance !== trainingPlan?.goal_distance ? goalDistance : undefined,
      new_target_date: targetDate ? format(targetDate, 'yyyy-MM-dd') : null,
      new_total_weeks: totalWeeks !== trainingPlan?.total_weeks ? totalWeeks : undefined,
      feedback_summary: feedback.trim() || undefined,
      modify_availability: showModifyAvailability,
      new_available_days: showModifyAvailability && availableDays.length > 0 ? availableDays : undefined,
      new_desired_weekly_days: showModifyAvailability && desiredWeeklyDays > 0 ? desiredWeeklyDays : undefined,
      new_long_run_day: showModifyAvailability && longRunDays.length > 0 ? longRunDays[0] : undefined,
    };

    // Fechar dialog imediatamente
    onOpenChange(false);

    // Disparar função de regeneração (que vai redirecionar)
    onConfirm(options);
  };

  const handleDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setGoalDistance(null);
    } else {
      // Normalize comma to dot
      const normalizedValue = value.replace(',', '.');
      const numValue = parseFloat(normalizedValue);
      if (!isNaN(numValue) && numValue >= 0) {
        setGoalDistance(numValue);
      }
    }
  };

  const handleWeeksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setTotalWeeks(null);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setTotalWeeks(numValue);
      }
    }
  };

  // Verifica se há pelo menos um campo preenchido para habilitar o botão
  const hasAnyFieldFilled = () => {
    // Feedback preenchido
    if (feedback.trim().length > 0) {
      return true;
    }

    // Toggle de disponibilidade ativado e campos preenchidos
    if (showModifyAvailability) {
      if (availableDays.length > 0 && desiredWeeklyDays > 0 && desiredWeeklyDays <= availableDays.length) {
        return true;
      }
    }

    // Toggle de objetivos gerais ativado e campos modificados
    if (showModifyGoals) {
      // Verifica se distância foi modificada
      if (goalDistance !== null && goalDistance !== trainingPlan?.goal_distance) {
        return true;
      }
      // Verifica se data foi modificada
      const planRaceDate = trainingPlan?.race_date ? parseISO(trainingPlan.race_date) : null;
      if (targetDate) {
        if (!planRaceDate || format(targetDate, 'yyyy-MM-dd') !== format(planRaceDate, 'yyyy-MM-dd')) {
          return true;
        }
      } else if (planRaceDate) {
        // Se tinha data antes e agora não tem
        return true;
      }
      // Verifica se semanas foram modificadas
      if (totalWeeks !== null && totalWeeks !== trainingPlan?.total_weeks) {
        return true;
      }
    }

    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-brand tracking-wide">Atualizar Plano de Treino</DialogTitle>
          <DialogDescription className="font-brand-tertiary space-y-2">
            <p>
              Use este formulário para ajustar as próximas corridas baseado no seu progresso atual. Seus treinos passados serão mantidos e considerados.
            </p>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Atualizando Plano</p>
              <p className="text-sm text-muted-foreground">Gerando treinos personalizados...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar até 60 segundos</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback sobre seu progresso</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Descreva como você está se sentindo, dificuldades encontradas, treinos que foram muito fáceis ou difíceis, ou qualquer feedback sobre o plano atual..."
                rows={5}
                className="resize-none font-brand-tertiary text-base bg-white"
              />
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="modifyAvailability" className="text-sm font-semibold cursor-pointer">
                  Você quer modificar sua disponibilidade?
                </Label>
                <Switch
                  id="modifyAvailability"
                  checked={showModifyAvailability}
                  onCheckedChange={setShowModifyAvailability}
                />
              </div>

              {showModifyAvailability && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="availableDays">Dias da Semana Disponíveis</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'monday', label: 'Segunda', initial: 'S' },
                        { value: 'tuesday', label: 'Terça', initial: 'T' },
                        { value: 'wednesday', label: 'Quarta', initial: 'Q' },
                        { value: 'thursday', label: 'Quinta', initial: 'Q' },
                        { value: 'friday', label: 'Sexta', initial: 'S' },
                        { value: 'saturday', label: 'Sábado', initial: 'S' },
                        { value: 'sunday', label: 'Domingo', initial: 'D' },
                      ].map((day) => (
                        <Card
                          key={day.value}
                          className={`w-12 h-12 cursor-pointer transition-all flex items-center justify-center ${availableDays.includes(day.value)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:border-primary/50'
                            }`}
                          onClick={() => {
                            if (availableDays.includes(day.value)) {
                              setAvailableDays(availableDays.filter((d) => d !== day.value));
                              // Se desmarcar um dia que era o longão, remover do longRunDays
                              if (longRunDays.includes(day.value)) {
                                setLongRunDays([]);
                              }
                            } else {
                              setAvailableDays([...availableDays, day.value]);
                            }
                          }}
                        >
                          <div className="text-sm font-bold">{day.initial}</div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {availableDays.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="desiredWeeklyDays">Quantas corridas por semana?</Label>

                      {/* Sugestão */}
                      {(() => {
                        // Calcula sugestão baseada nos dias disponíveis
                        const availableDaysCount = availableDays.length;
                        let suggestedDays = Math.min(3, availableDaysCount); // Sugestão padrão de 3 dias
                        if (availableDaysCount >= 2 && suggestedDays < 2) {
                          suggestedDays = 2;
                        }
                        if (availableDaysCount === 1) {
                          suggestedDays = 1;
                        }
                        return (
                          <div className="bg-primary/30 border border-primary/20 rounded-lg p-3 text-center">
                            <p className="text-sm text-black">
                              Sugestão:{" "}
                              <button
                                type="button"
                                onClick={() => setDesiredWeeklyDays(suggestedDays)}
                                className="font-semibold text-black hover:underline"
                              >
                                {suggestedDays} {suggestedDays === 1 ? 'dia' : 'dias'} por semana
                              </button>
                            </p>
                          </div>
                        );
                      })()}

                      {/* Botões clicáveis */}
                      <div className="grid grid-cols-4 gap-2 md:gap-3 max-w-xs">
                        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                          <Button
                            key={num}
                            type="button"
                            variant={desiredWeeklyDays === num ? "default" : "outline"}
                            size="lg"
                            onClick={() => setDesiredWeeklyDays(num)}
                            disabled={num > availableDays.length}
                            className={`h-12 md:h-14 text-lg font-semibold ${desiredWeeklyDays !== num ? 'bg-white' : ''}`}
                          >
                            {num}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {availableDays.length > 0 && desiredWeeklyDays >= 2 && (
                    <div className="space-y-2">
                      <Label htmlFor="longRunDay">Dia do Treino Longo (Opcional)</Label>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                          const sortedAvailableDays = [...availableDays].sort((a, b) => {
                            return dayOrder.indexOf(a) - dayOrder.indexOf(b);
                          });
                          return sortedAvailableDays.map((dayValue) => {
                            const dayLabels: Record<string, { label: string; initial: string }> = {
                              monday: { label: 'Segunda', initial: 'S' },
                              tuesday: { label: 'Terça', initial: 'T' },
                              wednesday: { label: 'Quarta', initial: 'Q' },
                              thursday: { label: 'Quinta', initial: 'Q' },
                              friday: { label: 'Sexta', initial: 'S' },
                              saturday: { label: 'Sábado', initial: 'S' },
                              sunday: { label: 'Domingo', initial: 'D' },
                            };
                            const day = dayLabels[dayValue] || { label: dayValue, initial: dayValue[0].toUpperCase() };
                            return (
                              <Card
                                key={`long-run-${dayValue}`}
                                className={`w-12 h-12 cursor-pointer transition-all flex items-center justify-center ${longRunDays.includes(dayValue)
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'hover:border-primary/50'
                                  }`}
                                onClick={() => {
                                  if (longRunDays.includes(dayValue)) {
                                    setLongRunDays([]);
                                  } else {
                                    setLongRunDays([dayValue]);
                                  }
                                }}
                              >
                                <div className="text-sm font-bold">{day.initial}</div>
                              </Card>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="modifyGoals" className="text-sm font-semibold cursor-pointer">
                  Você quer modificar seus objetivos gerais?
                </Label>
                <Switch
                  id="modifyGoals"
                  checked={showModifyGoals}
                  onCheckedChange={setShowModifyGoals}
                />
              </div>

              {showModifyGoals && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="goalDistance">Distância Alvo (km)</Label>
                    <Input
                      id="goalDistance"
                      type="number"
                      step="0.1"
                      min="0"
                      value={goalDistance ?? ''}
                      onChange={handleDistanceChange}
                      placeholder="Ex: 5, 10, 21, 42"
                      inputMode="decimal"
                      className="font-brand-tertiary text-base bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalWeeks">Duração do Plano (semanas)</Label>
                    <Input
                      id="totalWeeks"
                      type="number"
                      min="1"
                      max="52"
                      value={totalWeeks ?? ''}
                      onChange={handleWeeksChange}
                      placeholder="Ex: 8, 12, 16"
                      className="font-brand-tertiary text-base bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetDate">Data da Prova (Opcional)</Label>
                    <div className="border rounded-md py-4 px-3 bg-white flex justify-center">
                      <Calendar
                        mode="single"
                        selected={targetDate || undefined}
                        onSelect={(date) => {
                          setTargetDate(date || null);
                          if (date) {
                            setDisplayMonth(date);
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const compareDate = new Date(date);
                          compareDate.setHours(0, 0, 0, 0);
                          return compareDate < today;
                        }}
                        locale={ptBR}
                        showOutsideDays={false}
                        month={displayMonth}
                        onMonthChange={setDisplayMonth}
                        className="[&_.rdp-day_selected]:!bg-black [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected]:!rounded-full [&_.rdp-day_selected]:!border-0"
                      />
                    </div>
                    {targetDate && (
                      <p className="text-xs text-muted-foreground">
                        Data selecionada: {format(targetDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !hasAnyFieldFilled() ||
                  (showModifyAvailability && (availableDays.length === 0 || desiredWeeklyDays === 0 || desiredWeeklyDays > availableDays.length))
                }
                className="flex-1 font-brand font-bold tracking-wide uppercase"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar Plano'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

