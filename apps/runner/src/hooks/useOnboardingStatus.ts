import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useOnboardingStatus = () => {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const userId = user?.id ?? null;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['onboarding-status', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  return {
    isOnboardingCompleted: profile?.onboarding_status === 'completed',
    isOnboardingInProgress: profile?.onboarding_status === 'in_progress',
    isLoading: userLoading || profileLoading,
  };
};
