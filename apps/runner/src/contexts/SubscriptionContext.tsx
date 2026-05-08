import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionStatus } from '@/types/subscription';

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  canAddEntries: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Helper function to calculate subscription status from database row
const calculateSubscriptionStatus = (subData: any): SubscriptionStatus => {
  if (!subData) {
    return {
      subscribed: false,
      status: 'none',
      trialDaysLeft: 0,
      trialExpired: true,
      canAddEntries: false,
    };
  }

  const now = new Date();
  const trialEnd = new Date(subData.trial_end);
  const trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const trialExpired = now > trialEnd;

  // If no Stripe customer ID, this is a local pre-trial or expired pre-trial
  if (!subData.stripe_customer_id) {
    // If pre-trial expired, return expired status
    const status = (subData.status === 'pre-trial' && trialExpired) || subData.status === 'expired'
      ? 'expired'
      : subData.status === 'pre-trial'
        ? 'pre-trial'
        : subData.status || 'expired';

    return {
      subscribed: false,
      isTrial: status !== 'expired',
      status,
      trialDaysLeft,
      trialExpired,
      canAddEntries: !trialExpired && status !== 'expired',
      planType: subData.plan_type,
    };
  }

  // Map database status to subscription status
  let hasAccess = false;
  let isSubscribed = false;

  switch (subData.status) {
    case 'trialing':
      hasAccess = !trialExpired;
      isSubscribed = true;
      break;

    case 'active':
      hasAccess = true;
      isSubscribed = true;
      break;

    case 'past_due':
    case 'unpaid':
      hasAccess = false;
      isSubscribed = true; // Still has subscription, needs to manage it
      break;

    case 'canceled':
      hasAccess = false;
      isSubscribed = false;
      break;

    case 'expired':
      hasAccess = false;
      isSubscribed = false;
      break;

    default:
      hasAccess = false;
      isSubscribed = false;
  }

  return {
    subscribed: isSubscribed,
    isTrial: subData.status === 'trialing',
    status: subData.status,
    trialDaysLeft,
    trialExpired,
    canAddEntries: hasAccess,
    planType: subData.plan_type,
  };
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingRef = useRef(true);

  const fetchSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      // Fetch subscription directly from database
      const { data: subData, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        // No subscription found - return default state
        if (error.code === 'PGRST116') {
          setSubscription({
            subscribed: false,
            status: 'none',
            trialDaysLeft: 0,
            trialExpired: true,
            canAddEntries: false,
          });
        } else {
          console.error('[SubscriptionContext] Error fetching subscription:', error);
          setSubscription({
            subscribed: false,
            status: 'none',
            trialDaysLeft: 0,
            trialExpired: true,
            canAddEntries: false,
          });
        }
      } else {
        // Calculate subscription status from database row
        const status = calculateSubscriptionStatus(subData);
        setSubscription(status);
      }
    } catch (error) {
      console.error('[SubscriptionContext] Unexpected error fetching subscription:', error);
      // Sempre definir um estado padrão em caso de erro
      setSubscription({
        subscribed: false,
        status: 'none',
        trialDaysLeft: 0,
        trialExpired: true,
        canAddEntries: false,
      });
    } finally {
      // Garantir que loading sempre seja resolvido
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const refreshSubscription = useCallback(async () => {
    loadingRef.current = true;
    setLoading(true);
    try {
      await fetchSubscription();
    } catch (error) {
      console.error('[SubscriptionContext] Error in refreshSubscription:', error);
      // Garantir que loading sempre seja resolvido mesmo em caso de erro
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // Empty deps - fetchSubscription is stable

  useEffect(() => {
    loadingRef.current = true;

    // Timeout de segurança: se após 5 segundos ainda estiver em loading, forçar resolução
    timeoutRef.current = setTimeout(() => {
      if (loadingRef.current) {
        console.warn('[SubscriptionContext] Timeout de segurança ativado, forçando resolução do loading');
        // Se ainda não temos subscription, definir estado padrão
        setSubscription((prev) => {
          if (!prev) {
            return {
              subscribed: false,
              status: 'none',
              trialDaysLeft: 0,
              trialExpired: true,
              canAddEntries: false,
            };
          }
          return prev;
        });
        loadingRef.current = false;
        setLoading(false);
      }
    }, 5000);

    fetchSubscription();

    // Listen to auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        loadingRef.current = true;
        fetchSubscription();
      } else if (event === 'SIGNED_OUT') {
        setSubscription(null);
        loadingRef.current = false;
        setLoading(false);
      }
    });

    return () => {
      authSubscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const canAddEntries = subscription?.canAddEntries ?? false;

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription, canAddEntries }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptionContext = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
};
