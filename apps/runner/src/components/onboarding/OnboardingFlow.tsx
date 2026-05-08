import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Step1Goal } from "./Step1Goal";
import { Step2Target } from "./Step2Target";
import { Step3Timeline } from "./Step3Timeline";
import { Step5Availability } from "./Step5Availability";
import { Step4PersonalInfo } from "./Step4PersonalInfo";
import { Step6Goal } from "./Step6Goal";
import { OnboardingData } from "@/types/onboarding";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
  isLoading?: boolean;
  userId?: string;
}

export const OnboardingFlow = ({ onComplete, isLoading, userId }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({
    name: '',
    birthDate: '',
    sex: undefined,
    weightKg: 0,
    heightCm: 0,
    // Novos campos para corrida
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

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  console.log("🔄 OnboardingFlow renderizado - Step:", currentStep);

  useEffect(() => {
    console.log("📍 Step mudou para:", currentStep);
  }, [currentStep]);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Passo 1: Dados pessoais
        const canComplete = (
          formData.name !== '' &&
          formData.birthDate !== '' &&
          !!formData.sex &&
          formData.weightKg! > 0 &&
          formData.heightCm! > 0
        );
        return canComplete;
      case 2:
        // Passo 2: Nível de corrida
        return !!formData.runningLevel;
      case 3:
        // Passo 3: Quantas vezes corre atualmente
        return formData.currentRunningDays! >= 0 && formData.currentRunningDays! <= 7;
      case 4:
        // Passo 4: Distância atual
        return formData.runningDistance !== null && formData.runningDistance >= 0;
      case 5:
        // Passo 5: Meta + datas
        // Valida o tipo de meta primeiro
        if (!formData.runningGoal) return false;

        // Se "começar a correr": precisa de startDate
        if (formData.runningGoal === 'start_running') {
          return !!formData.startDate;
        }

        // Se "distância específica": precisa de TUDO
        if (formData.runningGoal === 'specific_distance') {
          const hasValidDates = formData.startDate && formData.targetDate &&
            formData.targetDate > formData.startDate;
          return (
            formData.goalDistance !== null && formData.goalDistance > 0 &&
            !!formData.goalTime &&
            (formData.goalTime !== 'custom' || formData.customGoalWeeks > 0) &&
            !!formData.startDate &&
            !!formData.targetDate &&
            hasValidDates
          );
        }

        return false;
      case 6:
        // Passo 6: Disponibilidade
        return (formData.availableDays && formData.availableDays.length > 0)
          && (formData.desiredWeeklyDays && formData.desiredWeeklyDays > 0)
          && (formData.desiredWeeklyDays <= formData.availableDays.length);
      default:
        return false;
    }
  };

  const handleNext = async () => {
    console.log("🚀 handleNext EXECUTADO!");
    console.log("▶️ handleNext chamado - Step atual:", currentStep, "Total steps:", totalSteps);
    console.log("📋 Dados do formulário:", formData);

    if (currentStep < totalSteps) {
      // Track step completion before advancing
      if (userId) {
        await track(`onboarding_step_${currentStep}_completed`, userId);
      }
      console.log("➡️ Avançando para próximo step");
      setCurrentStep((prev) => prev + 1);
    } else {
      // Track final step completion and wait for it to complete
      if (userId) {
        await track(`onboarding_step_${currentStep}_completed`, userId);
      }
      console.log("✅ Finalizando onboarding - chamando onComplete");
      // Reset viewport zoom antes de redirecionar
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
      sessionStorage.removeItem('onboarding_startDate');
      onComplete(formData as OnboardingData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="h-full bg-background flex flex-col overflow-x-hidden">
      <div className="container max-w-2xl mx-auto px-4 py-3 md:py-6 flex flex-col h-full">
        {/* Progress Bar */}
        <div className="mb-2 md:mb-6 space-y-1.5 md:space-y-2 flex-shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground font-brand-tertiary">
            <span>Passo {currentStep} de {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden mb-2 md:mb-6">
          <div className="flex items-start justify-center md:py-4">
            <div className="w-full">
              {currentStep === 1 && (
                <Step4PersonalInfo
                  name={formData.name!}
                  birthDate={formData.birthDate!}
                  sex={formData.sex as any}
                  weightKg={formData.weightKg!}
                  heightCm={formData.heightCm!}
                  onChange={updateField}
                />
              )}

              {currentStep === 2 && (
                <Step1Goal
                  value={formData.runningLevel as any}
                  onChange={(value) => updateField('runningLevel', value)}
                />
              )}

              {currentStep === 3 && (
                <Step2Target
                  value={formData.currentRunningDays!}
                  onChange={(value) => updateField('currentRunningDays', value)}
                />
              )}

              {currentStep === 4 && (
                <Step3Timeline
                  distance={formData.runningDistance}
                  onDistanceChange={(value) => {
                    updateField('runningDistance', value);
                    // Se selecionar 0km, automaticamente definir tempo como 0
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
              )}

              {currentStep === 5 && (
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
                  onStartDateChange={(date) => {
                    updateField('startDate', date);
                    if (date) {
                      sessionStorage.setItem('onboarding_startDate', date.toISOString());
                    }
                  }}
                />
              )}

              {currentStep === 6 && (
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
              )}
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-2 md:gap-3 flex-shrink-0 pb-safe md:pb-0">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="flex-1 h-10 md:h-11 relative border-2"
            >
              <ChevronLeft className="w-4 h-4 mr-auto" />
              <span className="absolute inset-0 flex items-center justify-center">
                VOLTAR
              </span>
            </Button>
          )}
          <Button
            onClick={(e) => {
              e.preventDefault();
              console.log("🖱️ BOTÃO CLICADO!");
              console.log("📊 Estado atual:", {
                currentStep,
                totalSteps,
                canProceed: canProceed(),
                isLoading,
                formData
              });
              handleNext();
            }}
            disabled={!canProceed() || isLoading}
            className="flex-1 h-10 md:h-11 font-brand font-bold tracking-wide uppercase relative"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <span className="absolute inset-0 flex items-center justify-center">
                  {currentStep === totalSteps ? 'Finalizar' : 'Próximo'}
                </span>
                {currentStep < totalSteps && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
