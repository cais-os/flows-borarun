import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type ProcessingStatus = 'processing' | 'success' | 'error';

const CheckoutSuccess = () => {
  const [status, setStatus] = useState<ProcessingStatus>('processing');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { refreshSubscription } = useSubscriptionContext();

  useEffect(() => {
    const processCheckout = async () => {
      // Prevent multiple simultaneous executions
      if (isProcessing) return;

      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');

      if (!sessionId) {
        console.error('No session_id found in URL');
        setStatus('error');
        return;
      }

      setIsProcessing(true);

      try {
        const { error } = await supabase.functions.invoke('process-checkout', {
          body: { sessionId }
        });

        if (error) {
          console.error('Error processing checkout:', error);
          setStatus('error');
        } else {
          setStatus('success');
          // Refresh subscription status
          await refreshSubscription();
          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
      } catch (error) {
        console.error('Error processing checkout:', error);
        setStatus('error');
      } finally {
        setIsProcessing(false);
      }
    };

    processCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === 'processing' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
              <h2 className="text-2xl font-bold">Processando pagamento...</h2>
              <p className="text-muted-foreground">
                Aguarde enquanto confirmamos sua assinatura
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
              <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
              <p className="text-muted-foreground">
                Sua assinatura foi ativada com sucesso. Redirecionando...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <XCircle className="w-16 h-16 mx-auto text-destructive" />
              <h2 className="text-2xl font-bold">Erro ao processar</h2>
              <p className="text-muted-foreground">
                Houve um problema ao confirmar sua assinatura. Entre em contato com o suporte.
              </p>
              <button
                onClick={() => navigate('/subscription')}
                className="text-primary hover:underline"
              >
                Voltar para planos
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
