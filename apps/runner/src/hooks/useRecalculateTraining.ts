import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RecalculateInput {
  completedTrainings: string[];
  userFeedback: string;
}

export const useRecalculateTraining = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RecalculateInput) => {
      const { data: result, error } = await supabase.functions.invoke(
        'recalculate-trainings',
        { body: data }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-plan'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });

      toast({
        title: 'Plano recalculado! 🎯',
        description: `Seu plano foi ajustado para as próximas ${data.weeks} semanas (${data.totalDistance}km total).`,
      });
    },
    onError: (error) => {
      console.error('Erro ao recalcular plano:', error);
      toast({
        title: 'Erro ao recalcular plano',
        description: error instanceof Error ? error.message : 'Não foi possível recalcular seu plano. Tente novamente.',
        variant: 'destructive',
      });
    },
  });
};
