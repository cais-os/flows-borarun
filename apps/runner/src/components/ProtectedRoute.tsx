import { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresOnboarding?: boolean;
}

export const ProtectedRoute = ({
  children,
  requiresAuth = true,
  requiresOnboarding = false,
}: ProtectedRouteProps) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificar autenticação
  useEffect(() => {
    let alive = true;

    // Função auxiliar para validar se o usuário ainda existe
    const validateUserExists = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        // Se houver erro ou o usuário não existir, limpar a sessão
        if (error || !user) {
          console.log('Usuário não encontrado ou deletado, limpando sessão...');
          await supabase.auth.signOut();
          return false;
        }
        return true;
      } catch (error) {
        console.error('Erro ao validar usuário:', error);
        await supabase.auth.signOut();
        return false;
      }
    };

    // Resolver o estado de auth no bootstrap usando getSession() como fonte principal
    const resolveBootstrapAuthState = (resolvedUserId: string | null, source: string) => {
      console.log(`[ProtectedRoute] Bootstrap auth resolved: userId=${resolvedUserId}, source=${source}`);
      if (!alive) return;
      // Se o bootstrap resolveu, o timeout não é mais necessário (evita warning falso)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setUserId(resolvedUserId);
      setAuthLoading(false);
    };

    const bootstrapAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Resolver o bootstrap imediatamente e validar em background (evita travar UI).
        resolveBootstrapAuthState(session?.user?.id ?? null, 'bootstrap-getSession');

        if (session) {
          validateUserExists().then((userExists) => {
            if (!alive) return;
            if (!userExists) {
              // validateUserExists já chamou signOut(); garantimos estado local consistente.
              setUserId(null);
              setAuthLoading(false);
            }
          });
        }
      } catch (error) {
        console.error('[ProtectedRoute] Erro no bootstrapAuth (getSession):', error);
        resolveBootstrapAuthState(null, 'bootstrap-getSession-error');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[ProtectedRoute] Auth state change: event=${event}, hasSession=${!!session}`);

        // Atualizar userId imediatamente para não bloquear UI.
        if (!alive) return;
        setUserId(session?.user?.id ?? null);

        // Validar se o usuário ainda existe em eventos críticos
        if (session && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          // Não bloquear aguardando validação (pode demorar e disparar timeout).
          validateUserExists().then((userExists) => {
            if (!alive) return;
            if (!userExists) {
              // validateUserExists já chamou signOut(); garantimos estado local consistente.
              setUserId(null);
            }
          });
        }
      }
    );

    // Timeout de segurança: se após 5 segundos ainda estiver em loading, forçar resolução
    timeoutRef.current = setTimeout(() => {
      console.warn('[ProtectedRoute] Timeout de segurança ativado, forçando resolução do loading');
      if (!alive) return;
      setAuthLoading(false);
    }, 5000);

    bootstrapAuth();

    return () => {
      alive = false;
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Query reativa para status de onboarding (REAGIRÁ às invalidações!)
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
    enabled: !!userId && requiresOnboarding && !authLoading,
    staleTime: 0, // Sempre buscar dados frescos
    refetchOnMount: true,
  });

  // Se está carregando auth, mostrar loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não está autenticado, redirecionar para login
  if (requiresAuth && !userId) {
    return <Navigate to="/auth" replace />;
  }

  // Se precisa de onboarding E ainda está carregando profile, mostrar loading
  if (requiresOnboarding && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Só redireciona para onboarding se temos certeza que não foi completado
  if (requiresOnboarding && profile && 'onboarding_status' in profile && profile.onboarding_status !== 'completed') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
