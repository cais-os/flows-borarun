import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isSafariDesktop } from '@/lib/utils';

export const useCustomerPortal = () => {
  const [loading, setLoading] = useState(false);

  const openCustomerPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data.url) {
        // Sempre usar redirect - funciona em todos os navegadores
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Erro ao abrir portal de assinatura. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return { openCustomerPortal, loading };
};
