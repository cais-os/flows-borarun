import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { Loader2 } from 'lucide-react';

import { useTrainingPlan } from '@/hooks/useTrainingPlan';
import { useUpdateTrainingGoals } from '@/hooks/useUpdateTrainingGoals';
import { OnboardingData } from '@/types/onboarding';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  birthDate: z.string(),
  sex: z.enum(['male', 'female']),
  heightCm: z.number().min(100).max(250),
});

const goalsSchema = z.object({
  goalDistance: z.number().min(0).nullable(),
  goalTime: z.enum(['8', '10', '12', '16', 'custom']),
  customGoalWeeks: z.number().min(1).max(52).optional(),
  targetDate: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type GoalsFormData = z.infer<typeof goalsSchema>;

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentData: Partial<OnboardingData>;
  type: 'profile' | 'goals';
}

export const EditProfileDialog = ({ open, onOpenChange, currentData, type }: EditProfileDialogProps) => {
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { trainingPlan, isLoading: isLoadingTrainingPlan } = useTrainingPlan();
  const { mutate: updateTrainingGoals, isPending: isUpdatingGoals } = useUpdateTrainingGoals();

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentData.name || '',
      birthDate: currentData.birthDate || '',
      sex: currentData.sex || 'male',
      heightCm: currentData.heightCm || 170,
    },
  });

  const goalsForm = useForm<GoalsFormData>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      goalDistance: 5,
      goalTime: '8',
      customGoalWeeks: 8,
      targetDate: '',
    },
  });

  // Reset form values when dialog opens or currentData changes
  useEffect(() => {
    if (open) {
      if (type === 'profile') {
        profileForm.reset({
          name: currentData.name || '',
          birthDate: currentData.birthDate || '',
          sex: currentData.sex || 'male',
          heightCm: currentData.heightCm || 170,
        });
      } else {
        // Para objetivos, resetar para valores padrão - serão preenchidos pelo plano de treino
        goalsForm.reset({
          goalDistance: 5,
          goalTime: '8',
          customGoalWeeks: 8,
          targetDate: '',
        });
      }
    }
  }, [open, currentData, type, profileForm, goalsForm]);

  // Atualizar valores do formulário quando o plano de treino carregar
  useEffect(() => {
    if (trainingPlan && open && type === 'goals') {
      // Usar distância diretamente como número
      const currentDistance = trainingPlan.goal_distance || 5;
      goalsForm.setValue('goalDistance', currentDistance);

      // Mapear tempo baseado no total de semanas
      const weeksMapping: Record<number, string> = {
        8: '8',
        10: '10',
        12: '12',
        16: '16'
      };

      const currentWeeks = trainingPlan.total_weeks;
      const mappedTime = weeksMapping[currentWeeks] || 'custom';
      goalsForm.setValue('goalTime', mappedTime as any);

      // Se for custom, definir o número de semanas
      if (mappedTime === 'custom') {
        goalsForm.setValue('customGoalWeeks', currentWeeks);
      }

      // Definir data da prova se existir
      if (trainingPlan.race_date) {
        goalsForm.setValue('targetDate', trainingPlan.race_date);
      }
    }
  }, [trainingPlan, open, type, goalsForm]);

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfile(data, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const onGoalsSubmit = (data: GoalsFormData) => {
    // Atualizar objetivos de treino
    const trainingData = {
      ...currentData,
      ...data,
      goalDistance: data.goalDistance || 5,
      goalTime: data.goalTime || '8',
      customGoalWeeks: data.customGoalWeeks || 8,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
    };

    updateTrainingGoals(trainingData, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === 'profile' ? 'Editar Perfil' : 'Editar Objetivos'}
          </DialogTitle>
        </DialogHeader>

        {type === 'profile' ? (
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                {...profileForm.register('name')}
              />
              {profileForm.formState.errors.name && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input
                id="birthDate"
                type="date"
                {...profileForm.register('birthDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sexo</Label>
              <Select
                value={profileForm.watch('sex')}
                onValueChange={(value) => profileForm.setValue('sex', value as 'male' | 'female')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weightKg">Peso (kg)</Label>
                <Input
                  id="weightKg"
                  type="number"
                  disabled
                  value={currentData.weightKg || ''}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heightCm">Altura (cm)</Label>
                <Input
                  id="heightCm"
                  type="number"
                  {...profileForm.register('heightCm', { valueAsNumber: true })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Para atualizar seu peso, use a seção de progresso do aplicativo.
            </p>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? 'Salvando...' : 'Salvar Perfil'}
              </Button>
            </div>
          </form>
        ) : isUpdatingGoals ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Atualizando Objetivos</p>
              <p className="text-sm text-muted-foreground">Gerando plano personalizado...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar até 30 segundos</p>
            </div>
          </div>
        ) : (
          <form onSubmit={goalsForm.handleSubmit(onGoalsSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goalDistance">Distância Alvo (km)</Label>
              <Input
                id="goalDistance"
                type="number"
                step="0.1"
                min="0"
                value={goalsForm.watch('goalDistance') ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    goalsForm.setValue('goalDistance', null);
                  } else {
                    // Normalizar vírgula para ponto
                    const normalizedValue = value.replace(',', '.');
                    const numValue = parseFloat(normalizedValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                      goalsForm.setValue('goalDistance', numValue);
                    }
                  }
                }}
                placeholder="0"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goalTime">Tempo para Meta</Label>
              <Select
                value={goalsForm.watch('goalTime')}
                onValueChange={(value) => goalsForm.setValue('goalTime', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 semanas</SelectItem>
                  <SelectItem value="10">10 semanas</SelectItem>
                  <SelectItem value="12">12 semanas</SelectItem>
                  <SelectItem value="16">16 semanas</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {goalsForm.watch('goalTime') === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customGoalWeeks">Semanas Personalizadas</Label>
                <Input
                  id="customGoalWeeks"
                  type="number"
                  min="1"
                  max="52"
                  {...goalsForm.register('customGoalWeeks', { valueAsNumber: true })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="targetDate">Data da Prova (Opcional)</Label>
              <Input
                id="targetDate"
                type="date"
                {...goalsForm.register('targetDate')}
              />
              <p className="text-xs text-muted-foreground">
                Se não informada, o plano começará imediatamente.
              </p>
            </div>


            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUpdatingGoals}
                className="flex-1"
              >
                {isUpdatingGoals ? 'Atualizando Objetivos...' : 'Atualizar Objetivos'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
