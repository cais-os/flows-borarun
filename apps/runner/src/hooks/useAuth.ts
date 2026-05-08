import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import { normalizePhone } from '@/lib/phoneUtils';
import { track } from '@/lib/analytics';


export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Função auxiliar para verificar se o usuário ainda existe no Supabase
  const validateUserExists = async () => {
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();

      // Se houver erro ou o usuário não existir, limpar a sessão
      if (error || !currentUser) {
        console.log('Usuário não encontrado ou deletado, limpando sessão...');
        await supabase.auth.signOut();
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erro ao validar usuário:', error);
      await supabase.auth.signOut();
      return false;
    }
  };

  useEffect(() => {
    let alive = true;

    // Timeout de segurança: nunca deixar a tela presa em loading.
    const loadingTimeout = setTimeout(() => {
      if (!alive) return;
      setLoading((prev) => {
        if (prev) {
          console.warn('[useAuth] Timeout de segurança ativado, liberando UI (loading=false)');
        }
        return false;
      });
    }, 5000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!alive) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle auth events
        if (event === 'SIGNED_OUT') {
          navigate('/auth');
          return;
        }

        // Validar se o usuário ainda existe em eventos críticos
        // TOKEN_REFRESHED ocorre automaticamente quando o token é atualizado
        // USER_UPDATED pode ocorrer, mas também verificamos para segurança
        if (session && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          // Não bloquear a UI aguardando validação.
          validateUserExists().then(() => {
            // validateUserExists já chama signOut() se necessário.
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      // Resolver o loading imediatamente e validar em background (evita tela branca).
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        validateUserExists().then(() => {
          // validateUserExists já chama signOut() se necessário.
        });
      }
    }).catch((error) => {
      console.error('[useAuth] Erro ao obter sessão (getSession):', error);
      if (!alive) return;
      setLoading(false);
    });

    return () => {
      alive = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  const sendOtp = async (phone: string, type: 'login' | 'signup' = 'login') => {
    const normalizedPhone = normalizePhone(phone);

    // signInWithOtp funciona tanto para login quanto signup
    // Se o usuário não existir, o Supabase cria automaticamente ao verificar o OTP
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        channel: 'sms',
      }
    });

    if (error) {
      // Tratar erros específicos
      let errorMessage = error.message;

      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        // For unified flow, this is just informational - user will be logged in
        errorMessage = 'Código enviado! Verifique seu telefone.';
      } else if (error.message.includes('not registered') || error.message.includes('Invalid login credentials')) {
        // For unified flow, this means a new account will be created
        errorMessage = 'Código enviado! Verifique seu telefone.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.';
      }

      toast({
        title: error.message.includes('rate limit') ? "Erro ao enviar código" : "Código enviado! 📱",
        description: errorMessage,
        variant: error.message.includes('rate limit') ? "destructive" : "default",
      });

      // Track OTP request if code was actually sent (even if there was a non-critical error)
      // Note: userId not available yet at OTP request stage, so we track without it
      if (!error.message.includes('rate limit') && (error.message.includes('already registered') || error.message.includes('not registered'))) {
        // OTP requested but no user yet - track with empty userId (will be handled by track function)
        track('auth_otp_requested', '', { metadata: { method: 'phone' } });
      }

      // Only return error for rate limiting or other critical errors
      if (error.message.includes('rate limit') || (!error.message.includes('already registered') && !error.message.includes('not registered'))) {
        return { error };
      }
    } else {
      // Track OTP request (successful send)
      // Note: userId not available yet at OTP request stage
      track('auth_otp_requested', '', { metadata: { method: 'phone' } });

      toast({
        title: "Código enviado! 📱",
        description: `Enviamos um código de verificação para ${normalizedPhone}`,
      });
    }

    return { error: null };
  };

  const verifyOtp = async (phone: string, token: string, type: 'login' | 'signup' = 'login') => {
    const normalizedPhone = normalizePhone(phone);

    // Para ambos login e signup, usamos verifyOtp com type 'sms'
    // O signup já foi iniciado no sendOtp, então verificamos com 'sms'
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token,
      type: 'sms',
    });

    if (error) {
      let errorMessage = error.message;

      if (error.message.includes('expired') || error.message.includes('Invalid token')) {
        errorMessage = 'Código inválido ou expirado. Solicite um novo código.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Muitas tentativas. Aguarde alguns instantes.';
      }

      toast({
        title: "Erro ao verificar código",
        description: errorMessage,
        variant: "destructive",
      });
      return { error };
    }

    if (type === 'signup') {
      toast({
        title: "Conta criada! 🎉",
        description: "Bem-vindo ao BORARUN!",
      });
    }

    return { error: null };
  };


  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Até logo! 👋",
      description: "Você foi desconectado com sucesso.",
    });

    return { error: null };
  };

  return {
    user,
    session,
    loading,
    sendOtp,
    verifyOtp,
    signOut,
  };
};

