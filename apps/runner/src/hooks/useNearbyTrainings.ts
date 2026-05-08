import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, isValid, parseISO, subDays } from 'date-fns';

const toDate = (input: Date | string): Date => {
  if (input instanceof Date) return input;
  const parsed = parseISO(input);
  return parsed;
};

export interface NearbyTraining {
  training: any;
  daysDiff: number;
  signedDaysDiff?: number;
}

export const useNearbyTrainings = (
  targetDate: Date | string | null | undefined,
  windowDays = 7,
  limit = 14,
) => {
  return useQuery({
    enabled: Boolean(targetDate),
    queryKey: ['nearby-trainings', targetDate, windowDays, limit],
    queryFn: async () => {
      if (!targetDate) return [];

      const baseDate = toDate(targetDate);
      if (!isValid(baseDate)) throw new Error('Data inválida para busca de treinos');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const start = subDays(baseDate, windowDays);
      const end = addDays(baseDate, windowDays);

      const { data, error } = await supabase
        .from('weekly_trainings')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .is('strava_activity_id', null)
        .order('date', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      const dayMs = 1000 * 60 * 60 * 24;
      const enriched: NearbyTraining[] = data.map((training) => {
        const trainingDate = toDate(training.date);
        const signedDaysDiff = Math.round((trainingDate.getTime() - baseDate.getTime()) / dayMs);
        const daysDiff = Math.abs(signedDaysDiff);
        return { training, daysDiff, signedDaysDiff };
      });

      return enriched
        .sort((a, b) => {
          // Primeiro por proximidade absoluta, depois passado, depois presente, depois futuro
          const abs = a.daysDiff - b.daysDiff;
          if (abs !== 0) return abs;
          const pri = (n: number | undefined) => (n === undefined ? 2 : n < 0 ? 0 : n === 0 ? 1 : 2);
          const pa = pri(a.signedDaysDiff);
          const pb = pri(b.signedDaysDiff);
          if (pa !== pb) return pa - pb;
          return a.training.date.localeCompare(b.training.date);
        })
        .slice(0, limit);
    },
  });
};
