import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, LogOut, User, Activity, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useStravaConnection } from '@/hooks/useStravaConnection';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { useTrainingPlan } from '@/hooks/useTrainingPlan';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { BottomNav } from '@/components/BottomNav';
import { AppHeader } from '@/components/AppHeader';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { useCustomerPortal } from '@/hooks/useCustomerPortal';
import { Skeleton } from '@/components/ui/skeleton';
import { track } from '@/lib/analytics';
import { useRegenerateTrainingPlan } from '@/hooks/useRegenerateTrainingPlan';
import { UpdateTrainingPlanDialog } from '@/components/UpdateTrainingPlanDialog';
import { useRefazerPlano } from '@/hooks/useRefazerPlano';
import { useTrainingGenerationStatus } from '@/hooks/useTrainingGenerationStatus';
import { startOfWeek, differenceInWeeks } from 'date-fns';
import poweredByStrava from '@/assets/branding/powered-by-strava.svg';

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut, user } = useAuth();
  const { profile, isLoading } = useUserProfile();
  const { connection, isConnected, connectStrava, disconnectStrava, isDisconnecting, isLoading: isLoadingStrava } = useStravaConnection();
  const { trainingPlan, isLoading: isLoadingTrainingPlan } = useTrainingPlan();
  const { subscription, loading: loadingSubscription } = useSubscriptionContext();
  const { openCustomerPortal, loading: loadingPortal } = useCustomerPortal();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showUpdatePlanDialog, setShowUpdatePlanDialog] = useState(false);
  const [showRefazerPlanDialog, setShowRefazerPlanDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { mutate: regeneratePlan, isPending: isRegenerating } = useRegenerateTrainingPlan();
  const { mutate: refazerPlano, isPending: isRefazendo } = useRefazerPlano();
  const { isGenerating: isGeneratingStatus } = useTrainingGenerationStatus();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Check for Strava OAuth callback result
  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    if (stravaStatus === 'success') {
      toast({
        title: "Conectado ao Strava! 🎉",
        description: "Agora você pode sincronizar suas atividades",
      });
    } else if (stravaStatus === 'error') {
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível conectar ao Strava",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const handleLogout = async () => {
    if (user?.id) {
      track('auth_logged_out', user.id);
    }
    await signOut();
    queryClient.clear();
    setShowLogoutDialog(false);
  };

  const handleUpdatePlan = (options: Parameters<typeof regeneratePlan>[0]) => {
    regeneratePlan(options, {
      onSuccess: () => {
        setShowUpdatePlanDialog(false);
      },
    });
  };

  const handleRefazerPlano = () => {
    refazerPlano(undefined, {
      onSuccess: () => {
        // Dialog será fechado automaticamente quando navegar para onboarding
        setShowRefazerPlanDialog(false);
      },
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getGoalLabel = (goalType: string) => {
    const goals = {
      maintain: 'Manter peso',
      lose: 'Perder peso',
      gain: 'Ganhar peso',
    };
    return goals[goalType as keyof typeof goals] || goalType;
  };

  // Calcular semana atual baseada na data (não em conclusão)
  const currentWeekNumber = useMemo(() => {
    if (!trainingPlan?.start_date) return 0;
    const planStart = startOfWeek(new Date(trainingPlan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekNumber = differenceInWeeks(currentWeekStart, planStart) + 1;
    // Limitar ao número total de semanas do plano
    return Math.min(Math.max(1, weekNumber), trainingPlan.total_weeks || 1);
  }, [trainingPlan?.start_date, trainingPlan?.total_weeks]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-nav">
        <AppHeader />
        <div className="max-w-md mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <AppHeader />
      <div className="max-w-md mx-auto">
        <div className="p-4 space-y-4">
          {/* Profile Card */}
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {profile?.name ? getInitials(profile.name) : <User className="w-8 h-8" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold tracking-wide">{profile?.name || 'Usuário'}</h2>
                <p className="text-sm text-muted-foreground font-brand-tertiary">
                  {profile?.phone ? formatPhoneDisplay(profile.phone) : user?.phone ? formatPhoneDisplay(user.phone) : 'Sem telefone'}
                </p>
              </div>
            </div>


            {profile && (
              <div className="space-y-2 mb-4 text-sm font-brand-tertiary">
                {isLoadingTrainingPlan ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : trainingPlan ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-black">Distância Alvo:</span>
                      <span className="font-normal">{trainingPlan.goal_distance}km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-black">Duração do Plano:</span>
                      <span className="font-normal">{trainingPlan.total_weeks} semanas</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-black">Progresso:</span>
                      <span className="font-normal">
                        {currentWeekNumber}/{trainingPlan.total_weeks} semanas
                      </span>
                    </div>
                    {trainingPlan.race_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-black">Data da Prova:</span>
                        <span className="font-normal">
                          {new Date(trainingPlan.race_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm">
                      Nenhum plano de treino encontrado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete o onboarding para criar seu plano
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="default"
              className="w-full mb-2 font-brand font-bold tracking-wide uppercase"
              onClick={() => {
                if (user?.id) {
                  track('activity_clicked_update_plan', user.id);
                }
                setShowUpdatePlanDialog(true);
              }}
              disabled={isRegenerating || isRefazendo || isGeneratingStatus || !trainingPlan}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating || isGeneratingStatus ? 'animate-spin' : ''}`} />
              {isRegenerating || isGeneratingStatus ? 'Atualizando...' : 'Atualizar Plano'}
            </Button>

            <Button
              variant="outline"
              className="w-full font-brand font-bold tracking-wide uppercase"
              onClick={() => {
                if (user?.id) {
                  track('activity_clicked_redo_plan', user.id);
                }
                setShowRefazerPlanDialog(true);
              }}
              disabled={isRegenerating || isRefazendo || isGeneratingStatus || !trainingPlan}
            >
              Refazer Plano
            </Button>
          </Card>

          {/* Strava Integration Card */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center">
                <Activity className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Strava</h3>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? '🔗 Conectado' : 'Sincronize suas atividades'}
                </p>
              </div>
            </div>
            <div className="mt-4 mb-4 space-y-2">
              {isLoadingStrava ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-brand-tertiary">
                    {isConnected
                      ? 'Conectado ao Strava. Quando você registrar uma corrida no Strava, ela será automaticamente sincronizada com seu plano de treino.'
                      : 'Conecte sua conta Strava para que suas corridas sejam automaticamente importadas e marcadas no seu plano de treino.'}
                  </p>
                  {connection?.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Última sync: {new Date(connection.last_sync_at).toLocaleString()}
                    </p>
                  )}
                  {connection?.last_error && (
                    <p className="text-xs text-destructive">
                      Último erro: {connection.last_error}
                    </p>
                  )}
                </>
              )}
            </div>
            <Button
              variant={isConnected ? "destructive" : "default"}
              className="w-full mt-2 font-brand font-bold tracking-wide uppercase"
              onClick={async () => {
                if (user?.id) {
                  if (isConnected) {
                    track('activity_clicked_disconnect_strava', user.id);
                  } else {
                    track('activity_clicked_connect_strava', user.id);
                  }
                }
                if (isConnected) {
                  void disconnectStrava();
                } else {
                  setIsConnecting(true);
                  try {
                    await connectStrava();
                  } catch (error) {
                    setIsConnecting(false);
                  }
                }
              }}
              disabled={isDisconnecting || isLoadingStrava || isConnecting}
            >
              {isDisconnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : isConnected ? (
                'Desconectar'
              ) : (
                'Conectar com Strava'
              )}
            </Button>
            <div className="mt-6 flex justify-center">
              <img
                src={poweredByStrava}
                alt="Powered by Strava"
                className="h-3"
              />
            </div>
          </Card>

          {/* Subscription Card */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Minha Assinatura</h3>
              </div>
            </div>
            {loadingSubscription ? (
              <Skeleton className="h-10 w-full mt-4" />
            ) : subscription?.status === 'canceled' ? (
              <>
                <p className="text-sm text-muted-foreground mt-4 mb-4 font-brand-tertiary">
                  Sua assinatura foi cancelada.
                </p>
                <Button
                  variant="default"
                  className="w-full mt-4 font-brand font-bold tracking-wide uppercase"
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_see_plans', user.id, {
                        metadata: { source: 'settings' }
                      });
                    }
                    navigate('/subscription');
                  }}
                >
                  Renovar Assinatura
                </Button>
              </>
            ) : subscription?.status === 'past_due' || subscription?.status === 'unpaid' ? (
              <>
                <p className="text-sm text-destructive mt-4 mb-4 font-brand-tertiary">
                  Pagamento pendente, atualize seu método de pagamento para continuar usando.
                </p>
                <Button
                  variant="default"
                  className="w-full mt-4 font-brand font-bold tracking-wide uppercase"
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_manage_subscription', user.id);
                    }
                    openCustomerPortal();
                  }}
                  disabled={loadingPortal}
                >
                  {loadingPortal ? 'Carregando...' : 'Gerenciar Assinatura'}
                </Button>
              </>
            ) : subscription?.subscribed && subscription?.status === 'trialing' ? (
              <>
                <p className="text-sm text-muted-foreground mt-4 mb-4 font-brand-tertiary">
                  Período de testes gratuito
                </p>
                <Button
                  variant="default"
                  className="w-full mt-4 font-brand font-bold tracking-wide uppercase"
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_manage_subscription', user.id);
                    }
                    openCustomerPortal();
                  }}
                  disabled={loadingPortal}
                >
                  {loadingPortal ? 'Carregando...' : 'Gerenciar Assinatura'}
                </Button>
              </>
            ) : subscription?.subscribed ? (
              <>
                <p className="text-sm text-muted-foreground mt-4 mb-4 font-brand-tertiary">
                  Sua assinatura está ativa
                </p>
                <Button
                  variant="default"
                  className="w-full mt-4 font-brand font-bold tracking-wide uppercase"
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_manage_subscription', user.id);
                    }
                    openCustomerPortal();
                  }}
                  disabled={loadingPortal}
                >
                  {loadingPortal ? 'Carregando...' : 'Gerenciar Assinatura'}
                </Button>
              </>
            ) : subscription?.isTrial && !subscription?.trialExpired ? (
              <>
                <p className="text-sm text-muted-foreground mt-4 mb-4 font-brand-tertiary">
                  Teste gratuito - faltam {subscription.trialDaysLeft} {subscription.trialDaysLeft === 1 ? 'dia' : 'dias'}
                </p>
                <Button
                  variant="default"
                  className="w-full font-brand font-bold tracking-wide uppercase"
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_see_plans', user.id, {
                        metadata: { source: 'settings' }
                      });
                    }
                    navigate('/subscription');
                  }}
                >
                  Ver Planos Premium
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-destructive mt-4 mb-4 font-brand-tertiary">
                  Você não possui uma assinatura ativa.
                </p>
                <Button
                  variant="default"
                  className="w-full mt-4 font-brand font-bold tracking-wide uppercase"
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_see_plans', user.id, {
                        metadata: { source: 'settings' }
                      });
                    }
                    navigate('/subscription');
                  }}
                >
                  Assinar Agora
                </Button>
              </>
            )}
          </Card>

          {/* TEMPORÁRIO: Botão de teste do webhook */}
          {/* <Card className="p-6 border-dashed border-2 border-yellow-500">
            <h3 className="font-semibold mb-2 text-yellow-600">🧪 Teste Webhook (Temporário)</h3>
            <p className="text-xs text-muted-foreground mb-4 font-brand-tertiary">
              Botões temporários para testar a função track
            </p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (user?.id) {
                    track('onboarding_started', user.id, { unique: true });
                    toast({
                      title: "Evento rastreado",
                      description: "onboarding-started - Verifique o console",
                    });
                  } else {
                    toast({
                      title: "Erro",
                      description: "Usuário não encontrado",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Testar onboarding-started
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (user?.id) {
                    track('onboarding_completed', user.id);
                    toast({
                      title: "Evento rastreado",
                      description: "onboarding-completed - Verifique o console",
                    });
                  } else {
                    toast({
                      title: "Erro",
                      description: "Usuário não encontrado",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Testar onboarding-completed
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (user?.id) {
                    track('onboarding_abandoned', user.id);
                    toast({
                      title: "Evento rastreado",
                      description: "onboarding-abandoned - Verifique o console",
                    });
                  } else {
                    toast({
                      title: "Erro",
                      description: "Usuário não encontrado",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Testar onboarding-abandoned
              </Button>
            </div>
          </Card> */}

          {/* Support Card */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center">
                <Mail className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Chamar Suporte</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 mb-4 font-brand-tertiary">
              Precisa de ajuda? Entre em contato conosco para tirar suas dúvidas ou enviar sugestões
            </p>
            <Button
              variant="default"
              className="w-full mt-4 font-brand font-bold tracking-wide uppercase"
              onClick={() => {
                const phone = '5551981447811'; // +55 51 98144-7811
                const url = `https://wa.me/${phone}`;
                if (typeof window !== 'undefined') {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              Contatar Suporte
            </Button>
          </Card>

          {/* Logout Button */}
          <Button
            variant="destructive"
            className="w-full font-brand font-bold tracking-wide uppercase"
            onClick={() => setShowLogoutDialog(true)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      <BottomNav activeTab="settings" />

      {/* Update Training Plan Dialog */}
      <UpdateTrainingPlanDialog
        open={showUpdatePlanDialog}
        onOpenChange={setShowUpdatePlanDialog}
        trainingPlan={trainingPlan}
        onConfirm={handleUpdatePlan}
        isLoading={isRegenerating}
      />

      {/* Refazer Plano Confirmation Dialog */}
      <AlertDialog open={showRefazerPlanDialog} onOpenChange={setShowRefazerPlanDialog}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-brand tracking-wide">Refazer Plano de Treino?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 font-brand-tertiary">
              <p>
                <strong>Atenção:</strong> Ao refazer o plano, você perderá todo o seu plano de treino atual e todos os treinos registrados.
              </p>
              <p>
                Você será redirecionado para a página de onboarding para criar um novo plano do zero.
              </p>
              <p className="text-destructive font-semibold">
                Esta ação não pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRefazendo} className="font-brand tracking-wide font-semibold uppercase">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefazerPlano}
              disabled={isRefazendo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-brand tracking-wide font-semibold uppercase"
            >
              {isRefazendo ? 'Processando...' : 'Continuar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será redirecionado para a tela de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
