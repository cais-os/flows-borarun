import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingPlan {
    id: string;
    user_id: string;
    goal_type: string;
    goal_distance: number | null;
    race_date: string | null;
    start_date: string | null;
    total_weeks: number;
    total_distance: number | null;
    completed_distance: number | null;
    completed_weeks: number | null;
    created_at: string | null;
    updated_at: string | null;
}

export const useTrainingPlan = () => {
    const { data: trainingPlan, isLoading, error } = useQuery({
        queryKey: ['training-plan'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const { data, error } = await supabase
                .from('training_plans')
                .select('*')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            return data as TrainingPlan | null;
        },
    });

    return {
        trainingPlan,
        isLoading,
        error,
    };
};
