import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { OnboardingData } from '@/types/onboarding';
import { Step4PersonalInfo } from '@/components/onboarding/Step4PersonalInfo';
import { Step1Goal } from '@/components/onboarding/Step1Goal';
import { Step2Target } from '@/components/onboarding/Step2Target';
import { Step3Timeline } from '@/components/onboarding/Step3Timeline';
import { Step5Availability } from '@/components/onboarding/Step5Availability';
import { Step6Goal } from '@/components/onboarding/Step6Goal';
import { format, parseISO } from 'date-fns';
import type { TrainingPlan } from '@/hooks/useTrainingPlan';

interface RefazerPlanoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any; // UserProfile type
  trainingPlan: TrainingPlan | null;
  onConfirm: (data: OnboardingData) => void;
  isLoading?: boolean;
}

export const RefazerPlanoDialog = ({
  open,
  onOpenChange,
  profile,
  trainingPlan,
  onConfirm,
  isLoading = false,
}: RefazerPlanoDialogProps) => {
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({
    name: '',
    birthDate: '',
    sex: undefined,
    weightKg: 0,
    heightCm: 0,
    runningLevel: undefined,
    currentRunningDays: -1,
    runningDistance: null,
    runningHours: 0,
    runningMinutes: 0,
    availableDays: [],
    desiredWeeklyDays: 3,
    longRunDays: [],
    startDate: null,
    runningGoal: undefined,
    goalDistance: null,
    goalHours: 0,
    goalMinutes: 0,
    goalTime: null,
    customGoalWeeks: 0,
    targetDate: null,
  });

  // Reset confirmation state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowConfirmation(true);
    }
  }, [open]);

  // Initialize form data from profile and trainingPlan
  useEffect(() => {
    if (open && profile) {
      // Calcular goalTime baseado no total_weeks do trainingPlan
      let goalTime: '8' | '10' | '12' | '16' | 'custom' | null = null;
      let customGoalWeeks = 0;
      if (trainingPlan?.total_weeks) {
        if (trainingPlan.total_weeks === 8) {
          goalTime = '8';
        } else if (trainingPlan.total_weeks === 10) {
          goalTime = '10';
        } else if (trainingPlan.total_weeks === 12) {
          goalTime = '12';
        } else if (trainingPlan.total_weeks === 16) {
          goalTime = '16';
        } else {
          goalTime = 'custom';
          customGoalWeeks = trainingPlan.total_weeks;
        }
      }

      // Determinar runningGoal baseado no goal_type do trainingPlan
      let runningGoal: 'start_running' | 'specific_distance' | undefined = undefined;
      if (trainingPlan?.goal_type) {
        if (trainingPlan.goal_type === 'start_running') {
          runningGoal = 'start_running';
        } else {
          runningGoal = 'specific_distance';
        }
      }

      // Normalizar birthDate para string no formato YYYY-MM-DD
      let birthDateStr = '';
      if (profile.birth_date) {
        if (profile.birth_date instanceof Date) {
          birthDateStr = format(profile.birth_date, 'yyyy-MM-dd');
        } else if (typeof profile.birth_date === 'string') {
          birthDateStr = profile.birth_date.split('T')[0]; // Remove time if present
        }
      } else if (profile.birthDate) {
        if (profile.birthDate instanceof Date) {
          birthDateStr = format(profile.birthDate, 'yyyy-MM-dd');
        } else if (typeof profile.birthDate === 'string') {
          birthDateStr = profile.birthDate.split('T')[0];
        }
      }

      // Helper function para parsear datas de forma segura
      const safeParseDate = (dateValue: string | Date | null | undefined): Date | null => {
        if (!dateValue) return null;
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'string') {
          try {
            return parseISO(dateValue);
          } catch (e) {
            console.warn('Erro ao parsear data:', dateValue, e);
            return null;
          }
        }
        return null;
      };

      setFormData({
        name: profile.name || '',
        birthDate: birthDateStr,
        sex: profile.sex || undefined,
        weightKg: profile.weight_kg || profile.weightKg || 0,
        heightCm: profile.height_cm || profile.heightCm || 0,
        runningLevel: profile.running_level || profile.runningLevel || undefined,
        currentRunningDays: profile.current_running_days ?? profile.currentRunningDays ?? -1,
        runningDistance: profile.running_distance ?? profile.runningDistance ?? null,
        runningHours: profile.running_hours ?? profile.runningHours ?? 0,
        runningMinutes: profile.running_minutes ?? profile.runningMinutes ?? 0,
        availableDays: profile.available_days || profile.availableDays || [],
        desiredWeeklyDays: profile.desired_weekly_days ?? profile.desiredWeeklyDays ?? 3,
        longRunDays: profile.long_run_days || profile.longRunDays || [],
        startDate: safeParseDate(trainingPlan?.start_date) || safeParseDate(profile.start_date) || (profile.startDate instanceof Date ? profile.startDate : null),
        runningGoal: runningGoal || profile.running_goal || profile.runningGoal || undefined,
        goalDistance: trainingPlan?.goal_distance ?? profile.goal_distance ?? profile.goalDistance ?? null,
        goalHours: profile.goal_hours ?? profile.goalHours ?? 0,
        goalMinutes: profile.goal_minutes ?? profile.goalMinutes ?? 0,
        goalTime: goalTime || profile.goal_time || profile.goalTime || null,
        customGoalWeeks: customGoalWeeks || (profile.custom_goal_weeks ?? profile.customGoalWeeks ?? 0),
        targetDate: safeParseDate(trainingPlan?.race_date) || safeParseDate(profile.target_date) || (profile.targetDate instanceof Date ? profile.targetDate : null),
      });
      setShowConfirmation(true);
    }
  }, [open, profile, trainingPlan]);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit = () => {
    return (
      formData.name !== '' &&
      formData.birthDate !== '' &&
      !!formData.sex &&
      formData.weightKg! > 0 &&
      formData.heightCm! > 0 &&
      !!formData.runningLevel &&
      formData.currentRunningDays! >= 0 &&
      formData.runningDistance !== null &&
      formData.runningDistance >= 0 &&
      !!formData.runningGoal &&
      (formData.runningGoal === 'start_running' ? !!formData.startDate : (
        formData.goalDistance !== null && formData.goalDistance > 0 &&
        !!formData.goalTime &&
        (formData.goalTime !== 'custom' || formData.customGoalWeeks! > 0) &&
        !!formData.startDate &&
        !!formData.targetDate
      )) &&
      formData.availableDays && formData.availableDays.length > 0 &&
      formData.desiredWeeklyDays && formData.desiredWeeklyDays > 0 &&
      formData.desiredWeeklyDays! <= formData.availableDays!.length
    );
  };

  const handleConfirmation = () => {
    setShowConfirmation(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    const completeData: OnboardingData = {
      name: formData.name!,
      birthDate: formData.birthDate!,
      sex: formData.sex!,
      weightKg: formData.weightKg!,
      heightCm: formData.heightCm!,
      runningLevel: formData.runningLevel!,
      currentRunningDays: formData.currentRunningDays!,
      runningDistance: formData.runningDistance,
      runningHours: formData.runningHours!,
      runningMinutes: formData.runningMinutes!,
      availableDays: formData.availableDays!,
      desiredWeeklyDays: formData.desiredWeeklyDays!,
      longRunDays: formData.longRunDays!,
      startDate: formData.startDate,
      runningGoal: formData.runningGoal!,
      goalDistance: formData.goalDistance,
      goalHours: formData.goalHours!,
      goalMinutes: formData.goalMinutes!,
      goalTime: formData.goalTime!,
      customGoalWeeks: formData.customGoalWeeks!,
      targetDate: formData.targetDate,
      onboarding_channel: 'app',
    };

    onConfirm(completeData);
  };

  if (!open) return null;

  // Don't render if profile is not available
  if (!profile) {
    return null;
  }

  // Confirmation dialog
  if (showConfirmation) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-brand tracking-wide">Refazer Plano de Treino?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 font-brand-tertiary">
                  <p>
                    <strong>Atenção:</strong> Ao refazer o plano, você perderá todo o seu plano de treino atual e todos os treinos registrados.
                  </p>
                  <p>
                    Um novo plano será gerado do zero baseado nas suas novas respostas do formulário BORARUN.
                  </p>
                  <p className="text-destructive font-semibold">
                    Esta ação não pode ser desfeita.
                  </p>
                </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading} className="font-brand tracking-wide font-semibold uppercase">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmation();
              }}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-brand tracking-wide font-semibold uppercase"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Form dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-brand tracking-wide">Refazer Plano de Treino</DialogTitle>
          <DialogDescription className="font-brand-tertiary space-y-2">
            <p>
              Você está prestes a recriar seu plano do zero. Todos os campos estão pré-preenchidos com seus dados atuais. Modifique o que desejar.
            </p>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Criando Novo Plano</p>
              <p className="text-sm text-muted-foreground">Gerando treinos personalizados...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar até 60 segundos</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-lg font-semibold">Dados Pessoais</h3>
              <Step4PersonalInfo
                name={formData.name || ''}
                birthDate={formData.birthDate || ''}
                sex={formData.sex}
                weightKg={formData.weightKg || 0}
                heightCm={formData.heightCm || 0}
                onChange={updateField}
              />
            </div>

            {/* Nível de Corrida */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-lg font-semibold">Nível de Corrida</h3>
              <Step1Goal
                value={formData.runningLevel}
                onChange={(value) => updateField('runningLevel', value)}
              />
            </div>

            {/* Corridas por Semana */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-lg font-semibold">Corridas por Semana</h3>
              <Step2Target
                value={formData.currentRunningDays!}
                onChange={(value) => updateField('currentRunningDays', value)}
              />
            </div>

            {/* Distância Atual */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-lg font-semibold">Distância Atual</h3>
              <Step3Timeline
                distance={formData.runningDistance}
                onDistanceChange={(value) => {
                  updateField('runningDistance', value);
                  if (value === 0) {
                    updateField('runningHours', 0);
                    updateField('runningMinutes', 0);
                  }
                }}
                hours={formData.runningHours!}
                minutes={formData.runningMinutes!}
                onTimeChange={(hours, minutes) => {
                  updateField('runningHours', hours);
                  updateField('runningMinutes', minutes);
                }}
              />
            </div>

            {/* Objetivo e Datas */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-lg font-semibold">Objetivo e Datas</h3>
              <Step6Goal
                value={formData.runningGoal}
                onChange={(value) => updateField('runningGoal', value)}
                selectedDistance={formData.goalDistance}
                onDistanceChange={(distance) => updateField('goalDistance', distance)}
                goalHours={formData.goalHours}
                goalMinutes={formData.goalMinutes}
                onGoalTimeChange={(hours, minutes) => {
                  updateField('goalHours', hours);
                  updateField('goalMinutes', minutes);
                }}
                selectedTime={formData.goalTime}
                onTimeChange={(time) => updateField('goalTime', time)}
                customWeeks={formData.customGoalWeeks}
                onCustomWeeksChange={(weeks) => updateField('customGoalWeeks', weeks)}
                targetDate={formData.targetDate}
                onTargetDateChange={(date) => updateField('targetDate', date)}
                startDate={formData.startDate}
                onStartDateChange={(date) => updateField('startDate', date)}
              />
            </div>

            {/* Disponibilidade */}
            <div className="space-y-4 pb-6">
              <h3 className="text-lg font-semibold">Disponibilidade</h3>
              <Step5Availability
                selectedDays={formData.availableDays!}
                onDaysChange={(days) => updateField('availableDays', days)}
                desiredDays={formData.desiredWeeklyDays || 3}
                onDesiredDaysChange={(days) => updateField('desiredWeeklyDays', days)}
                longRunDays={formData.longRunDays!}
                onLongRunDaysChange={(days) => updateField('longRunDays', days)}
                runningLevel={formData.runningLevel!}
                currentRunningDays={formData.currentRunningDays!}
              />
            </div>

            <DialogFooter className="flex gap-2 pt-4 border-t">
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
                disabled={isLoading || !canSubmit()}
                className="flex-1 font-brand font-bold tracking-wide uppercase bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Refazer Plano'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

