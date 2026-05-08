import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UpdateManualTrainingInput {
  id: string;
  date?: string;
  type?: string;
  distanceKm?: number;
  elapsedTimeSeconds?: number;
  paceSeconds?: number | null;
  difficulty_level?: number | null;
  feedbacks?: string | null;
}

export const useUpdateManualTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateManualTrainingInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const updatePayload: Record<string, unknown> = { completed: true };

      if (input.date) updatePayload.date = input.date;
      if (input.type) updatePayload.type = input.type;
      if (input.distanceKm !== undefined) {
        const distance = Math.round(input.distanceKm * 1000);
        updatePayload.distance = distance;
        updatePayload.actual_distance = distance;
      }
      if (input.elapsedTimeSeconds !== undefined) {
        updatePayload.elapsed_time = input.elapsedTimeSeconds;
        updatePayload.actual_elapsed_time = input.elapsedTimeSeconds;
      }
      const paceSeconds = input.paceSeconds ?? (
        input.distanceKm && input.elapsedTimeSeconds
          ? Math.round(input.elapsedTimeSeconds / input.distanceKm)
          : undefined
      );
      if (paceSeconds !== undefined) {
        updatePayload.pace = paceSeconds;
        updatePayload.actual_pace = paceSeconds;
      }
      if (input.difficulty_level !== undefined) {
        updatePayload.difficulty_level = input.difficulty_level;
      }
      if (input.feedbacks !== undefined) {
        updatePayload.feedbacks = input.feedbacks;
      }

      const { error } = await supabase
        .from("manual_trainings")
        .update(updatePayload)
        .eq("id", input.id)
        .eq("user_id", user.id);

      if (error) throw error;
      return input.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-trainings"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-trainings"] });
      queryClient.invalidateQueries({ queryKey: ["training-by-date"] });
      toast({ title: "Treino manual atualizado" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar treino",
        description: error.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });
};

