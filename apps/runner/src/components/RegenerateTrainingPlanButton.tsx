import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

export const RegenerateTrainingPlanButton = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { user } = useAuth();

  // Verificar se existe plano sem treinos
  const { data: needsRegeneration, isLoading } = useQuery({
    queryKey: ['needs-plan-regeneration'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Buscar plano
      const { data: plan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!plan) return false;

      // Verificar se tem treinos
      const { count } = await supabase
        .from('weekly_trainings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      return count === 0; // Retorna true se não tem treinos
    },
  });

  const handleRegenerate = async () => {
    // Track redo plan
    if (user?.id) {
      track('activity_clicked_redo_plan', user.id);
    }
    
    setIsRegenerating(true);
    console.log('🔄 Iniciando regeneração do plano de treino...');

    try {
      toast({
        title: "Gerando treinos... ⏳",
        description: "Isso pode levar até 60 segundos. Por favor, aguarde.",
      });

      const { data: result, error } = await supabase.functions.invoke('generate-training-plan', {
        body: {}
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!result || !result.trainingsCount || result.trainingsCount === 0) {
        throw new Error("Nenhum treino foi gerado. Por favor, tente novamente.");
      }

      console.log(`✅ ${result.trainingsCount} treinos regenerados (${result.totalDistance}km)`);

      // Refetch queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] }),
        queryClient.invalidateQueries({ queryKey: ['training-plan'] }),
        queryClient.invalidateQueries({ queryKey: ['needs-plan-regeneration'] }),
      ]);

      toast({
        title: "Plano regenerado com sucesso! 🎉",
        description: `${result.trainingsCount} treinos foram criados (${result.totalDistance}km total)`,
      });

    } catch (error: any) {
      console.error('❌ Erro ao regenerar plano:', error);
      toast({
        title: "Erro ao regenerar plano",
        description: error.message || "Não foi possível gerar seus treinos. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading || !needsRegeneration) {
    return null;
  }

  return (
    <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-500" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          Seu plano de treino foi criado, mas os treinos ainda não foram gerados. Clique para gerar agora.
        </span>
        <Button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          {isRegenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar Treinos
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
