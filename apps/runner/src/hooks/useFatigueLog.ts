import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export interface FatigueLog {
    id: string;
    user_id: string;
    date: string;
    level: number;
    feedback: string | null;
    created_at: string;
    updated_at: string;
}

export const useFatigueLog = (date: Date) => {
    const queryClient = useQueryClient();
    const dateString = format(date, 'yyyy-MM-dd');

    // Query para buscar fatigue log da data específica
    const { data: fatigueLog, isLoading } = useQuery({
        queryKey: ['fatigue-log', dateString],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Não autenticado');

            const { data, error } = await supabase
                .from('fatigue_logs' as any)
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateString)
                .maybeSingle();

            if (error) throw error;
            return (data as unknown as FatigueLog | null);
        },
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });

    // Mutation para upsert (insert ou update)
    const upsertMutation = useMutation({
        mutationFn: async ({ level, feedback }: { level: number; feedback?: string | null }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Não autenticado');

            const { data, error } = await supabase
                .from('fatigue_logs' as any)
                .upsert(
                    {
                        user_id: user.id,
                        date: dateString,
                        level,
                        feedback: feedback || null,
                    },
                    {
                        onConflict: 'user_id,date',
                    }
                )
                .select()
                .single();

            if (error) throw error;
            return (data as unknown as FatigueLog);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fatigue-log', dateString] });
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao salvar fadiga',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Mutation para deletar (quando usuário desselecionar)
    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Não autenticado');

            const { error } = await supabase
                .from('fatigue_logs' as any)
                .delete()
                .eq('user_id', user.id)
                .eq('date', dateString);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fatigue-log', dateString] });
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao remover fadiga',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    return {
        fatigueLog,
        isLoading,
        upsertFatigueLog: upsertMutation.mutateAsync,
        deleteFatigueLog: deleteMutation.mutateAsync,
        isUpserting: upsertMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
};

