import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUserProfile = () => {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar profile básico e dados de onboarding
      const [profileResult, onboardingResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('onboarding_data')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;

      // Combinar dados de profile e onboarding_data
      return {
        ...profileResult.data,
        ...onboardingResult.data,
      };
    },
  });

  return {
    profile,
    isLoading,
    weightKg: profile?.weight_kg ? Number(profile.weight_kg) : 70,
  };
};
