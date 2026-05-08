import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingData } from '@/types/onboarding';
import { useToast } from '@/hooks/use-toast';

export const useUpdateTrainingGoals = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (data: Partial<OnboardingData>) => {
            // Buscar usuário atual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            // Buscar dados existentes de onboarding do banco se faltarem campos
            let existingOnboardingData: any = null;
            const needsOnboardingData = !data.name || !data.birthDate || !data.sex || !data.weightKg || !data.heightCm;

            if (needsOnboardingData) {
                const { data: onboardingData, error: onboardingError } = await supabase
                    .from('onboarding_data')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!onboardingError && onboardingData) {
                    existingOnboardingData = {
                        name: onboardingData.name || '',
                        birthDate: onboardingData.birth_date || '',
                        sex: onboardingData.sex || 'male',
                        weightKg: onboardingData.weight_kg ? Number(onboardingData.weight_kg) : 0,
                        heightCm: onboardingData.height_cm ? Number(onboardingData.height_cm) : 0,
                    };
                }
            }

            // Garantir que todos os campos obrigatórios estejam presentes
            // Priorizar dados fornecidos, depois dados do banco, e só usar valores padrão como último recurso
            const completeData: OnboardingData = {
                user_id: user.id,
                name: data.name || existingOnboardingData?.name || '',
                birthDate: data.birthDate || existingOnboardingData?.birthDate || '',
                sex: (data.sex || existingOnboardingData?.sex || 'male') as 'male' | 'female',
                weightKg: data.weightKg || existingOnboardingData?.weightKg || 0,
                heightCm: data.heightCm || existingOnboardingData?.heightCm || 0,
                runningLevel: data.runningLevel || 'beginner',
                currentRunningDays: data.currentRunningDays ?? 3,
                runningDistance: data.runningDistance ?? 5,
                runningHours: data.runningHours ?? 0,
                runningMinutes: data.runningMinutes ?? 30,
                availableDays: data.availableDays || ['monday', 'wednesday', 'friday'],
                desiredWeeklyDays: data.desiredWeeklyDays ?? 3,
                longRunDays: data.longRunDays || [],
                startDate: data.startDate || new Date(),
                runningGoal: data.runningGoal || 'specific_distance',
                goalDistance: data.goalDistance ?? 5,
                goalHours: data.goalHours ?? 0,
                goalMinutes: data.goalMinutes ?? 0,
                goalTime: data.goalTime || '8',
                customGoalWeeks: data.customGoalWeeks ?? 0,
                targetDate: data.targetDate || null,
            };

            const { data: result, error } = await supabase.functions.invoke(
                'create-training-plan',
                {
                    body: completeData,
                }
            );

            if (error) throw error;
            return result;
        },
        onSuccess: (data) => {
            // Invalidar queries relacionadas ao plano de treino
            queryClient.invalidateQueries({ queryKey: ['training-plan'] });
            queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });

            toast({
                title: 'Objetivos atualizados!',
                description: `Plano de treino regenerado com ${data.weeks} semanas e ${data.totalDistance}km total.`,
            });
        },
        onError: (error) => {
            console.error('Erro ao atualizar objetivos:', error);
            toast({
                title: 'Erro ao atualizar objetivos',
                description: 'Não foi possível atualizar seus objetivos de treino. Tente novamente.',
                variant: 'destructive',
            });
        },
    });
};
