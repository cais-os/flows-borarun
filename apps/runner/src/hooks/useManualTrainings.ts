import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export const useManualTrainings = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: [
      'manual-trainings',
      startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate ? format(endDate, 'yyyy-MM-dd') : null,
    ],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      let query = supabase
        .from('manual_trainings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (startDate && endDate) {
        query = query
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

