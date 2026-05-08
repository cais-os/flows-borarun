import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export const useTrainingByDate = (date: Date) => {
  const dateString = format(date, 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['training-by-date', dateString],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('weekly_trainings')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateString)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log(`📊 useTrainingByDate(${dateString}):`, data);
      
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
