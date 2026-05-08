import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useResetUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Chamar Edge Function para resetar onboarding
      const { data, error } = await supabase.functions.invoke('reset-onboarding', {
        body: { user_id: user.id },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao resetar onboarding');
      }

      return true;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['training-plan'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-check'] });

      toast({
        title: "Dados resetados com sucesso",
        description: "Você será redirecionado para o onboarding",
      });
    },
    onError: (error: Error) => {
      console.error('Error resetting user:', error);
      toast({
        title: "Erro ao resetar dados",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });
};
