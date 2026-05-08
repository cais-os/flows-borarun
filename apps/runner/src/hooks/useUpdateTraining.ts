import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { timeStringToSeconds } from '@/lib/utils';

export const useUpdateTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trainingId,
      completed,
      actualDistance,
      actualElapsedTime,
      difficultyLevel,
      feedbacks
    }: {
      trainingId: string;
      completed: boolean;
      /** Distance in kilometers from UI; converted to meters before sending */
      actualDistance?: number;
      /** Time string or number; converted to seconds before sending */
      actualElapsedTime?: string | number;
      difficultyLevel?: number | null;
      feedbacks?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Preparar body da requisição
      const body: any = {
        user_id: user.id,
        training_id: trainingId,
        completed,
      };

      // Adicionar campos opcionais apenas se fornecidos
      if (actualDistance !== undefined) {
        body.actual_distance = Math.round(actualDistance * 1000);
      }
      if (actualElapsedTime !== undefined) {
        const elapsedSeconds =
          typeof actualElapsedTime === 'number'
            ? actualElapsedTime
            : timeStringToSeconds(actualElapsedTime);
        body.actual_elapsed_time = elapsedSeconds;
      }
      if (difficultyLevel !== undefined) {
        body.difficulty_level = difficultyLevel;
      }
      if (feedbacks !== undefined) {
        body.feedbacks = feedbacks;
      }

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('update-training', {
        body,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao atualizar treino');
      }

      return data.data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['training', variables.trainingId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['training-by-date'] });

      toast({
        title: variables.completed ? "Treino concluído! 🎉" : "Treino desmarcado",
        description: variables.completed
          ? "Parabéns por completar seu treino!"
          : "Treino marcado como não concluído",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar treino",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
