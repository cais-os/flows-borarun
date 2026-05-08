import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StravaConnection {
  id: string;
  user_id: string;
  athlete_id: number;
  access_token_expires_at: string;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const useStravaConnection = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query connection status
  const { data: connection, isLoading } = useQuery({
    queryKey: ['strava-connection'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .schema('strava')
        .from('strava_accounts')
        .select('id,user_id,athlete_id,access_token_expires_at,last_sync_at,last_error,created_at,updated_at')
        .maybeSingle();

      if (error) throw error;
      return data as StravaConnection | null;
    },
  });

  const isConnected = !!connection;

  // Connect to Strava (initiates OAuth flow)
  const connectStrava = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.functions.invoke('strava-oauth', {
      body: { action: 'start' },
    });

    if (error || !data?.authorizeUrl) {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conexão com o Strava",
        variant: "destructive",
      });
      return;
    }

    window.location.href = data.authorizeUrl as string;
  };

  // Disconnect from Strava
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Call edge function to properly deauthorize on Strava and delete from database
      const { data, error } = await supabase.functions.invoke('strava-disconnect', {
        body: {},
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao desconectar do Strava');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strava-connection'] });
      toast({
        title: "Desconectado",
        description: "Strava desconectado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync activities for a specific date
  const syncMutation = useMutation({
    mutationFn: async (date: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('strava-sync', {
        body: { date },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exercise-entries'] });
      toast({
        title: "Sincronizado! 🎉",
        description: data.message || `${data.imported} atividade(s) importada(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    connection,
    isConnected,
    isLoading,
    connectStrava,
    disconnectStrava: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    syncStrava: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
  };
};
