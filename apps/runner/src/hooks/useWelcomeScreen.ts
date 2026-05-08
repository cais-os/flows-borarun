import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WelcomeStatus {
  has_seen_welcome_screen: boolean | null;
  onboarding_status: string | null;
}

export const useWelcomeScreen = () => {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['welcome-screen-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('has_seen_welcome_screen, onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as WelcomeStatus | null;
    },
  });

  const markAsSeenMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ has_seen_welcome_screen: true })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-screen-status'] });
    },
  });

  const shouldShowWelcome = (() => {
    if (!status) return false;
    // Tratar null como false para exibir o welcome
    return status.has_seen_welcome_screen === false || status.has_seen_welcome_screen === null;
  })();

  return {
    shouldShowWelcome,
    isLoading,
    markAsSeen: markAsSeenMutation.mutateAsync,
    isMarking: markAsSeenMutation.isPending,
  };
};

