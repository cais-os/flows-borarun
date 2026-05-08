import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface LinkStravaInput {
    stravaActivityId: number;
    date?: string; // YYYY-MM-DD override if needed
    trainingId?: string;
}

export const useLinkStravaActivity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ stravaActivityId, date, trainingId }: LinkStravaInput) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Não autenticado");

            const { data, error } = await supabase.functions.invoke("link-strava-activity", {
                body: {
                    user_id: user.id,
                    strava_activity_id: stravaActivityId,
                    training_id: trainingId,
                    date,
                },
            });

            if (error) throw error;
            if (!data?.success) {
                throw new Error(data?.error || "Erro ao vincular atividade");
            }

            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["weekly-trainings"] });
            queryClient.invalidateQueries({ queryKey: ["training-by-date"] });
            queryClient.invalidateQueries({ queryKey: ["strava-activities"] });
            queryClient.invalidateQueries({ queryKey: ["unlinked-strava-activities"] });
            toast({ title: "Atividade vinculada ao plano!" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao vincular atividade",
                description: error.message || "Tente novamente em instantes.",
                variant: "destructive",
            });
        },
    });
};

