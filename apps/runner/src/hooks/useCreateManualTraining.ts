import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CreateManualTrainingInput {
  date: string; // YYYY-MM-DD
  type: string;
  distanceKm: number;
  elapsedTimeSeconds: number;
  paceSeconds?: number | null;
  difficulty_level?: number | null;
  feedbacks?: string | null;
}

export const useCreateManualTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateManualTrainingInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const paceSeconds = input.paceSeconds ?? Math.round(input.elapsedTimeSeconds / input.distanceKm);

      const body = {
        user_id: user.id,
        date: input.date,
        type: input.type,
        distance: Math.round(input.distanceKm * 1000),
        elapsed_time: input.elapsedTimeSeconds,
        pace: paceSeconds ?? null,
        difficulty_level: input.difficulty_level ?? null,
        feedbacks: input.feedbacks ?? null,
        completed: true,
      };

      const { data, error } = await supabase.functions.invoke('create-manual-training', {
        body,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar treino manual');

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['training-by-date'] });
      toast({ title: 'Treino manual criado!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar treino',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    },
  });
};

