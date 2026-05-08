import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export const useRefazerPlano = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (): Promise<{ success: boolean }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Deletar a row do onboarding_data
      // Os triggers do banco vão:
      // 1. Atualizar onboarding_status para 'not_started'
      // 2. Deletar o training_plan (e weekly_trainings)
      // 3. Definir onboarding_channel como NULL
      const { error: deleteError } = await supabase
        .from('onboarding_data')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(`Erro ao deletar dados de onboarding: ${deleteError.message}`);
      }

      console.log(`✅ Row do onboarding_data deletada para usuário ${user.id}`);

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['training-plan'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-check'] });

      // Redirecionar para onboarding - o app vai detectar que onboarding_status é 'not_started'
      navigate('/onboarding', { replace: true });
    },
    onError: (error: Error) => {
      console.error('Error refazendo plano:', error);
      toast({
        title: "Erro ao refazer plano",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });
};

