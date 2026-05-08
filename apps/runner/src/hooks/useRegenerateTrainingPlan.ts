import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RegenerateTrainingPlanOptions {
  cutoff_date?: string;
  allow_goal_modification?: boolean;
  new_goal_distance?: number | null;
  new_target_date?: string | null;
  new_total_weeks?: number | null;
  feedback_summary?: string;
  modify_availability?: boolean;
  new_available_days?: string[];
  new_desired_weekly_days?: number;
  new_long_run_day?: string;
}

export const useRegenerateTrainingPlan = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (options?: RegenerateTrainingPlanOptions) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Atualizar status para 'generating' antes de chamar a edge function
      const { error: statusError } = await supabase
        .from('profiles')
        .update({ training_generation_status: 'generating' })
        .eq('user_id', user.id);

      if (statusError) {
        console.error('⚠️ Erro ao atualizar status para generating:', statusError);
        // Não lançar erro aqui para não quebrar o fluxo
      }

      // Redirecionar imediatamente para o dashboard (antes de chamar a edge function)
      navigate('/', { replace: true });

      const body: { user_id: string } & RegenerateTrainingPlanOptions = {
        user_id: user.id,
        ...options,
      };

      const { data, error } = await supabase.functions.invoke('regenerate-training-plan', {
        body,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao regenerar plano de treino');
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['training-plan'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['training-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['training-generation-status'] });

      toast({
        title: "Plano atualizado com sucesso! 🎉",
        description: `${data.trainingsCount} treinos futuros regenerados`,
      });
    },
    onError: async (error: Error) => {
      console.error('Error regenerating training plan:', error);

      // Atualizar status para 'failed' em caso de erro
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ training_generation_status: 'failed' })
          .eq('user_id', user.id);
      }

      toast({
        title: "Erro ao atualizar plano",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });
};

