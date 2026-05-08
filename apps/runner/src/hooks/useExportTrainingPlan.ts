import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getSupabaseUrl(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  if (envUrl && !envUrl.includes('127.0.0.1') && !envUrl.includes('localhost')) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = 54321;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://127.0.0.1:${port}`;
    }

    return `http://${hostname}:${port}`;
  }

  return envUrl || `http://127.0.0.1:54321`;
}

export const useExportTrainingPlan = () => {
  const [loading, setLoading] = useState(false);

  const exportPlan = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa fazer login para exportar o plano.');
        setLoading(false);
        return;
      }

      // Obter URL do Supabase
      const supabaseUrl = getSupabaseUrl();

      // Chamar edge function diretamente com fetch para obter blob
      const response = await fetch(`${supabaseUrl}/functions/v1/export-training-plan-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        // Tentar obter mensagem de erro se for JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || errorData.details || 'Failed to export plan');
        } else {
          throw new Error(`Failed to export plan: ${response.statusText}`);
        }
      }

      // Verificar se a resposta é realmente um PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        // Pode ser um erro em formato JSON
        const errorData = await response.json().catch(() => ({ error: 'Invalid response format' }));
        throw new Error(errorData.error || 'Invalid response format');
      }

      // Obter blob do PDF
      const blob = await response.blob();

      // Criar URL temporária e fazer download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plano-treino.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Plano exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting training plan:', error);
      toast.error('Erro ao exportar plano. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return { exportPlan, loading };
};






