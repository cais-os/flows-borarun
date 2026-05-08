import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { track } from '@/lib/analytics';

// Helper function to create a timeout promise
const createTimeout = (ms: number) => {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
};

export const useCheckout = () => {
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingYearly, setLoadingYearly] = useState(false);
  // Use ref to track active request ID and prevent race conditions
  const requestIdRef = useRef(0);

  const createCheckout = async (planType: 'monthly' | 'yearly') => {
    // Set loading state for the specific plan
    const setLoading = planType === 'monthly' ? setLoadingMonthly : setLoadingYearly;

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);

    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa fazer login para assinar.');
        // Only reset if this is still the active request
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
        return;
      }

      // Track checkout initiated
      track('subscription_checkout_initiated', session.user.id, {
        metadata: { planType },
      });

      // Create timeout promise (15 seconds)
      const timeoutPromise = createTimeout(15000);

      // Create checkout promise
      const checkoutPromise = supabase.functions.invoke('create-checkout', {
        body: { planType },
      });

      // Race between checkout and timeout
      const result = await Promise.race([
        checkoutPromise,
        timeoutPromise,
      ]) as { data: any; error: any };

      // Check if this request is still the active one (prevent race conditions)
      if (currentRequestId !== requestIdRef.current) {
        // This request was superseded by a newer one, ignore the result
        return;
      }

      // Handle timeout
      if (result.error?.message === 'TIMEOUT' || result === undefined) {
        toast.error('A requisição demorou muito. Por favor, tente novamente.');
        setLoading(false);
        return;
      }

      const { data, error } = result;

      // Handle other errors
      if (error) {
        // Check for specific error types
        if (error.message?.includes('503') || error.status === 503) {
          toast.error('Serviço temporariamente indisponível. Por favor, tente novamente em alguns instantes.');
        } else if (error.message?.includes('Network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
          toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        } else {
          toast.error('Erro ao criar sessão de pagamento. Tente novamente.');
        }
        console.error('Error creating checkout:', error);
        setLoading(false);
        return;
      }

      // Handle successful response
      if (data?.url) {
        // Sempre usar redirect - funciona em todos os navegadores e navegadores embutidos
        window.location.href = data.url;
        // Don't reset loading here - let the redirect handle it
      } else {
        toast.error('Resposta inválida do servidor. Tente novamente.');
        setLoading(false);
      }
    } catch (error: any) {
      // Check if this request is still the active one
      if (currentRequestId !== requestIdRef.current) {
        // This request was superseded by a newer one, ignore the error
        return;
      }

      console.error('Error creating checkout:', error);

      // Handle different error types
      if (error?.message === 'TIMEOUT') {
        toast.error('A requisição demorou muito. Por favor, tente novamente.');
      } else if (error?.status === 503 || error?.message?.includes('503')) {
        toast.error('Serviço temporariamente indisponível. Por favor, tente novamente em alguns instantes.');
      } else if (error?.message?.includes('Network') || error?.message?.includes('fetch') || error?.message?.includes('Failed to fetch')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error('Erro ao criar sessão de pagamento. Tente novamente.');
      }
      setLoading(false);
    }
  };

  return {
    createCheckout,
    loadingMonthly,
    loadingYearly,
    // Keep backward compatibility
    loading: loadingMonthly || loadingYearly,
  };
};
