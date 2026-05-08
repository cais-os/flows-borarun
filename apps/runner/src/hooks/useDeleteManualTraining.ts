import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";

export const useDeleteManualTraining = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (trainingId: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Não autenticado");

            const { error } = await supabase
                .from("manual_trainings")
                .delete()
                .eq("id", trainingId)
                .eq("user_id", user.id);

            if (error) throw error;
            return trainingId;
        },
        onSuccess: (trainingId) => {
            queryClient.invalidateQueries({ queryKey: ["manual-trainings"] });
            queryClient.invalidateQueries({ queryKey: ["weekly-trainings"] });
            queryClient.invalidateQueries({ queryKey: ["training-by-date"] });
            if (user?.id) {
                track("training_manual_run_deleted", user.id, {
                    metadata: { trainingId },
                }).catch((error) => console.warn("Failed to track training_manual_run_deleted", error));
            }
            toast({ title: "Treino manual deletado" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao deletar treino",
                description: error.message || "Tente novamente em instantes.",
                variant: "destructive",
            });
        },
    });
};

