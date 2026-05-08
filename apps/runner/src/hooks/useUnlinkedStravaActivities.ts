import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, isValid, parseISO, subDays } from 'date-fns';

const toDate = (input: Date | string | null | undefined): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return input;
  const parsed = parseISO(input);
  return isValid(parsed) ? parsed : null;
};

export interface UnlinkedStravaActivity {
  activity: any;
  daysDiff: number;
  signedDaysDiff?: number;
}

export const useUnlinkedStravaActivities = (
  targetDate: Date | string | null | undefined,
  windowDays = 7,
  limit = 20,
) => {
  return useQuery({
    enabled: Boolean(targetDate),
    queryKey: ['unlinked-strava-activities', targetDate, windowDays, limit],
    queryFn: async () => {
      if (!targetDate) return [];

      const baseDate = toDate(targetDate);
      if (!baseDate) throw new Error('Data inválida para busca de atividades');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const start = subDays(baseDate, windowDays);
      const end = addDays(baseDate, windowDays);

      const { data, error } = await supabase
        .schema('strava')
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('linked_to_plan', false)
        .or('type.eq.Run,sport_type.eq.Run') // considerar apenas corridas
        .gte('start_date', `${format(start, 'yyyy-MM-dd')}T00:00:00`)
        .lte('start_date', `${format(end, 'yyyy-MM-dd')}T23:59:59`)
        .order('start_date', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      const dayMs = 1000 * 60 * 60 * 24;
      const enriched: UnlinkedStravaActivity[] = data.map((activity) => {
        const startDateStr = activity.start_date_local ?? activity.start_date;
        const activityDate = toDate(startDateStr);
        if (!activityDate) {
          return { activity, daysDiff: Number.MAX_SAFE_INTEGER, signedDaysDiff: undefined };
        }
        const signedDaysDiff = Math.round((activityDate.getTime() - baseDate.getTime()) / dayMs);
        const daysDiff = Math.abs(signedDaysDiff);
        return { activity, daysDiff, signedDaysDiff };
      });

      return enriched
        .sort((a, b) => {
          const abs = a.daysDiff - b.daysDiff;
          if (abs !== 0) return abs;
          const pri = (n: number | undefined) => (n === undefined ? 2 : n < 0 ? 0 : n === 0 ? 1 : 2);
          const pa = pri(a.signedDaysDiff);
          const pb = pri(b.signedDaysDiff);
          if (pa !== pb) return pa - pb;
          const aDate = a.activity.start_date ?? '';
          const bDate = b.activity.start_date ?? '';
          return aDate.localeCompare(bDate);
        })
        .slice(0, limit);
    },
  });
};

