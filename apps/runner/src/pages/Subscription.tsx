import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
// import { Sparkles } from 'lucide-react';
import { PLANS } from '@/types/subscription';
import { useCheckout } from '@/hooks/useCheckout';
import { useCustomerPortal } from '@/hooks/useCustomerPortal';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { SafariRedirectNotice } from '@/components/SafariRedirectNotice';
import { AppHeader } from '@/components/AppHeader';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

const Subscription = () => {
  const navigate = useNavigate();
  const { createCheckout, loadingMonthly, loadingYearly } = useCheckout();
  const { openCustomerPortal, loading: portalLoading } = useCustomerPortal();
  const { subscription } = useSubscriptionContext();
  const { user } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    'Planos de treino personalizados',
    'Dicas do treinador IA a cada treino',
    'Integração com Strava',
    'Acompanhamento de desempenho',
  ];

  const handleSubscribe = (planType: 'monthly' | 'yearly') => {
    createCheckout(planType);
  };

  const handleBack = () => {
    navigate('/settings');
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showBackButton={true} onBack={handleBack} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          {/*
          <div className="inline-flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-brand font-semibold">3 dias grátis + 7 dias extras no Stripe</span>
          </div>
          */}
          <h1 className="text-4xl font-brand font-bold mb-4">Escolha seu plano</h1>
          {/*
          <p className="text-lg font-brand-tertiary text-muted-foreground max-w-2xl mx-auto">
            Comece seu <span className="text-black font-bold">teste gratuito de 7 dias</span> e receba seu plano personalizado.
          </p>
          */}
        </div>

        {/* Safari Redirect Notice */}
        <SafariRedirectNotice />

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Monthly Plan */}
          <Card className="p-6 bg-white hover:shadow-2xl hover:shadow-primary/20 transition-all border-2 border-gray-200">
            <div className="mb-4">
              <h3 className="text-2xl font-brand font-black mb-2">{PLANS.monthly.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-brand font-bold">{PLANS.monthly.price}</span>
                <span className="font-brand-secondary text-muted-foreground">{PLANS.monthly.period}</span>
              </div>
              <p className="text-sm font-brand-tertiary text-muted-foreground mt-2">
                Cancele quando quiser
              </p>
            </div>
            <Button
              size="lg"
              className="w-full mb-4 font-brand font-bold bg-primary text-black hover:bg-primary/90 transition-all hover:scale-105"
              onClick={() => {
                if (user?.id) {
                  track('activity_clicked_subscribe_monthly_plan', user.id);
                }
                handleSubscribe(PLANS.monthly.planType);
              }}
              disabled={loadingMonthly || loadingYearly}
            >
              {loadingMonthly ? 'Processando...' : 'Assinar Plano Mensal'}
            </Button>
            {/*
            <div className="text-xs font-brand-tertiary text-center text-muted-foreground">
              3 dias + 7 dias no Stripe, depois {PLANS.monthly.price}/mês
            </div>
            */}
          </Card>

          {/* Yearly Plan */}
          <Card className="p-6 bg-white border-primary border-2 relative hover:shadow-2xl hover:shadow-primary/20 transition-all">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-brand font-semibold">
                {PLANS.yearly.savings}
              </span>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-brand font-black mb-2">{PLANS.yearly.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-brand font-bold">{PLANS.yearly.price}</span>
                <span className="font-brand-secondary text-muted-foreground">{PLANS.yearly.period}</span>
              </div>
              <p className="text-sm font-brand-tertiary text-muted-foreground mt-2">
                {PLANS.yearly.totalPrice}
              </p>
            </div>
            <Button
              size="lg"
              className="w-full mb-4 font-brand font-bold bg-primary text-black hover:bg-primary/90 transition-all hover:scale-105"
              onClick={() => handleSubscribe(PLANS.yearly.planType)}
              disabled={loadingMonthly || loadingYearly}
            >
              {loadingYearly ? 'Processando...' : 'Assinar Plano Anual'}
            </Button>
            {/*
            <div className="text-xs font-brand-tertiary text-center text-muted-foreground">
              3 dias + 7 dias no Stripe, depois {PLANS.yearly.totalPrice}
            </div>
            */}
          </Card>
        </div>

        {/* Benefits */}
        <Card className="p-6 mb-8 bg-white border-2 border-gray-200">
          <h3 className="text-xl font-brand font-bold mb-4">Tudo incluído em ambos os planos:</h3>
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm font-brand-tertiary">{benefit}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Manage Subscription */}
        {subscription?.subscribed && (
          <div className="text-center">
            <p className={`text-sm font-brand-tertiary mb-3 ${subscription?.status === 'past_due' || subscription?.status === 'unpaid' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {subscription?.status === 'past_due' || subscription?.status === 'unpaid'
                ? 'Pagamento pendente, atualize seu método de pagamento.'
                : 'Já é assinante?'}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (user?.id) {
                  track('activity_clicked_manage_subscription', user.id);
                }
                openCustomerPortal();
              }}
              disabled={portalLoading}
              className="font-brand font-bold"
            >
              {portalLoading ? 'Carregando...' : 'Gerenciar Assinatura'}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Subscription;
