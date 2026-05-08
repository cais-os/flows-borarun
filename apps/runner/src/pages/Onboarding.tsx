import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { OnboardingData } from "@/types/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasNavigated = useRef(false);
  const hasSetOnboardingChannel = useRef(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Query reativa para usuário atual
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Definir onboarding_channel como 'app' quando página carregar
  useEffect(() => {
    if (user?.id && !hasSetOnboardingChannel.current) {
      hasSetOnboardingChannel.current = true;
      supabase
        .from('profiles')
        .update({ onboarding_channel: 'app' })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) {
            console.error('❌ Erro ao definir onboarding_channel:', error);
          } else {
            console.log('✅ onboarding_channel definido como "app"');
          }
        });
    }
  }, [user?.id]);

  // Track onboarding started quando página carregar
  // unique: true garante que o evento só será disparado uma vez, mesmo em refresh
  useEffect(() => {
    if (user?.id) {
      track('onboarding_started', user.id, { unique: true });
    }
  }, [user?.id]);

  // Query reativa para verificar status de onboarding
  const { data: profile } = useQuery({
    queryKey: ['onboarding-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Redirecionar automaticamente se onboarding já foi completado
  useEffect(() => {
    if (profile?.onboarding_status === 'completed' && !hasNavigated.current) {
      console.log('✅ Onboarding já completado, redirecionando para home');
      hasNavigated.current = true;
      setIsTransitioning(true);
      navigate('/', { replace: true });
    }
  }, [profile?.onboarding_status, navigate]);

  const handleComplete = async (data: OnboardingData) => {
    setIsLoading(true);
    console.log("Dados do onboarding:", data);

    try {
      // Salvar perfil do usuário primeiro
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      console.log("👤 User ID:", user.id);

      // Atualizar dados do onboarding de forma redundante para garantir redirecionamento para home
      const { error: onboardingDataError } = await supabase.from('onboarding_data')
        .upsert(
          {
            user_id: user.id,
            name: data.name,
            birth_date: data.birthDate,
            sex: data.sex,
            weight_kg: data.weightKg,
            height_cm: data.heightCm,
          }
          ,
          {
            onConflict: 'user_id',
          }
        );

      console.log('✅ onboarding_data salvo com sucesso previamente à Edge Function');

      if (onboardingDataError) {
        console.error('❌ Erro ao salvar onboarding_data:', onboardingDataError);
        throw new Error(onboardingDataError.message || 'Erro ao salvar dados do onboarding previamente à Edge Function');
      }

      // Track onboarding completed
      track('onboarding_completed', user.id);

      // Chamar edge function de forma assíncrona (sem await)
      // A edge function agora cria onboarding_data e atualiza onboarding_channel
      supabase.functions.invoke('create-training-plan', {
        body: { ...data, user_id: user.id, onboarding_channel: 'app' },
      }).then(({ data: planData, error: planError }) => {
        if (planError) {
          console.error('❌ Erro na edge function (assíncrono):', planError);
          // Não mostrar toast aqui pois usuário pode ter fechado a página
        } else {
          console.log("✅ Plano de treino criado com sucesso (assíncrono)");
          console.log("Plano de treino gerado:", planData);
        }
      }).catch((error) => {
        console.error('❌ Erro ao chamar edge function (assíncrono):', error);
      });

      // Atualizar cache local
      await queryClient.refetchQueries({ queryKey: ['onboarding-status'] });
      await queryClient.refetchQueries({ queryKey: ['onboarding-check', user.id] });
      await queryClient.refetchQueries({ queryKey: ['training-generation-status'] });

      // Adicionar delay antes de redirecionar para garantir que tudo foi processado
      setIsTransitioning(true);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay de 500ms

      console.log('🚀 Navegando para home (geraçao de treino em background)');
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error("💥 Erro capturado no onboarding:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        fullError: error,
      });

      toast({
        title: "Erro ao processar dados",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user?.id) {
      track('auth_logged_out', user.id);
    }
    await signOut();
    queryClient.clear();
  };

  // Mostrar loading durante transição para evitar "piscada"
  if (isTransitioning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader showLogoutButton={true} onLogout={handleLogout} />
      <div className="flex-1 overflow-hidden">
        <OnboardingFlow onComplete={handleComplete} isLoading={isLoading} userId={user?.id} />
      </div>
    </div>
  );
};

export default Onboarding;
