import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface StravaActivity {
  activity_id: number;
  user_id: string;
  athlete_id: number;
  name: string | null;
  type: string | null;
  sport_type: string | null;
  start_date: string | null;
  start_date_local: string | null;
  timezone: string | null;
  moving_time: number | null;
  elapsed_time: number | null;
  distance: number | null;
  total_elevation_gain: number | null;
  average_speed: number | null;
  max_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_cadence: number | null;
  calories: number | null;
  device_watts: boolean | null;
  elev_high: number | null;
  elev_low: number | null;
  raw_data: Record<string, unknown> | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useStravaActivities = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: [
      'strava-activities',
      startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate ? format(endDate, 'yyyy-MM-dd') : null,
    ],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      let query = supabase
        .schema('strava')
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (startDate && endDate) {
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        query = query
          .gte('start_date', `${startDateStr}T00:00:00`)
          .lte('start_date', `${endDateStr}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StravaActivity[];
    },
  });
};

