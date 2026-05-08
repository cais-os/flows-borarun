import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TrainingGenerationStatus = 'idle' | 'generating' | 'completed' | 'failed' | 'timeout';

export const useTrainingGenerationStatus = () => {
    const queryClient = useQueryClient();
    const prevStatusRef = useRef<TrainingGenerationStatus | null>(null);

    const { data: profile, isLoading } = useQuery({
        queryKey: ['training-generation-status'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('training_generation_status, onboarding_status')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        refetchInterval: (query) => {
            // Polling ativo apenas quando status é 'generating'
            const data = query.state.data;
            if (!data) return false;
            // Se status não é 'generating', para o polling
            if (data.training_generation_status !== 'generating') return false;
            // Se onboarding não foi completado, não precisa verificar
            if (data.onboarding_status !== 'completed') return false;
            // Caso contrário, continua polling a cada 5 segundos
            return 5000;
        },
    });

    const status = (profile?.training_generation_status as TrainingGenerationStatus) ?? 'idle';
    const isGenerating = status === 'generating';
    const canRetry = status === 'failed' || status === 'timeout';
    const isCompleted = status === 'completed';

    // Detectar quando a geração termina e invalidar queries de treinos
    useEffect(() => {
        const prevStatus = prevStatusRef.current;
        const currentStatus = status;

        // Se mudou de 'generating' para 'completed' (geração acabou de terminar)
        if (prevStatus === 'generating' && currentStatus === 'completed') {
            console.log('✅ Geração de treino concluída! Invalidando queries de treinos...');
            // Invalidar todas as queries relacionadas a treinos
            queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
            queryClient.invalidateQueries({ queryKey: ['training-by-date'] });
            queryClient.invalidateQueries({ queryKey: ['training-plan'] });
        }

        // Atualizar referência
        prevStatusRef.current = currentStatus;
    }, [status, queryClient]);

    return {
        isGenerating,
        isLoading,
        canRetry,
        isCompleted,
        status,
    };
};

