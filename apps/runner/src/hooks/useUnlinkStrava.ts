import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useUnlinkStrava = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trainingId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('unlink-strava-activity', {
        body: { user_id: user.id, training_id: trainingId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao desvincular atividade');

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['training-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-strava-activities'] });
      toast({ title: 'Atividade desvinculada do Strava' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao desvincular',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    },
  });
};

