import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ChevronLeft, ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { zodResolver } from '@hookform/resolvers/zod';
import { phoneSchema, formatPhoneDisplay } from '@/lib/phoneUtils';
import { track } from '@/lib/analytics';

const phoneOnlySchema = z.object({
  phone: phoneSchema,
});

const otpSchema = z.object({
  otp: z.string().length(6, 'Código deve ter 6 dígitos'),
});

type PhoneFormData = z.infer<typeof phoneOnlySchema>;
type OtpFormData = z.infer<typeof otpSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp, user, loading } = useAuth();

  // Estados para controle do fluxo OTP
  const [otpSent, setOtpSent] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneOnlySchema),
    defaultValues: {
      phone: '',
    },
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: '',
    },
  });

  // Timer para reenvio de código
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    navigate('/dashboard');
  }, [user, loading, navigate]);

  const handleSendOtp = async (data: PhoneFormData) => {
    setIsLoading(true);

    // Track phone entry
    track('auth_entered_phone', '', {
      metadata: { phone: data.phone },
    });

    // sendOtp auto-detects login vs signup
    const result = await sendOtp(data.phone);

    if (!result.error) {
      setPhoneNumber(data.phone);
      setOtpSent(true);
      setCountdown(60); // 60 segundos antes de permitir reenvio
      otpForm.reset();
    }

    setIsLoading(false);
  };

  const handleVerifyOtp = async (data: OtpFormData) => {
    setIsVerifying(true);

    // Track OTP entry
    track('auth_entered_otp', '', {
      metadata: { phone: phoneNumber },
      channels: { ga4: 'sign_up', metaPixel: 'CompleteRegistration' }
    });

    // verifyOtp works for both login and signup
    const result = await verifyOtp(phoneNumber, data.otp);

    if (!result.error) {
      // O usuário será redirecionado automaticamente pelo useAuth quando autenticado
      track('auth_successful_login', user?.id, { metadata: { method: 'phone' } });
    } else {
      // Track failed login
      track('auth_failed_login', '', {
        metadata: { phone: phoneNumber, reason: result.error?.message || 'unknown' },
      });
      // Limpar OTP em caso de erro para tentar novamente
      otpForm.setValue('otp', '');
    }

    setIsVerifying(false);
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    const result = await sendOtp(phoneNumber);

    if (!result.error) {
      setCountdown(60);
    }

    setIsLoading(false);
  };

  const handleBackToPhone = () => {
    setOtpSent(false);
    otpForm.reset();
    setCountdown(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header Banner */}
      <div className="w-full py-6 px-4 relative" style={{ backgroundColor: '#daf46c' }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            track('auth_back_button', user?.id, {
              metadata: {
                from_screen: otpSent ? 'otp' : 'phone',
                action: otpSent ? 'back_to_phone' : 'back_to_landing'
              }
            });
            if (otpSent) {
              handleBackToPhone();
            } else {
              navigate('/');
            }
          }}
          className="absolute left-2 top-6 text-black hover:text-black/70"
        >
          <ChevronLeft style={{ width: '28px', height: '28px' }} strokeWidth={2} />
        </Button>
        <div className="max-w-7xl mx-auto flex justify-center">
          <h1 className="text-4xl md:text-5xl font-brand" style={{ color: '#000000' }}>
            BORARUN
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, #daf46c 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="w-full max-w-md relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              {!otpSent ? (
                <motion.div
                  key="phone-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-2 border-primary/20 shadow-lg">
                    <CardHeader>
                      <CardTitle className="font-brand font-bold text-2xl tracking-wide">
                        Bora correr?
                      </CardTitle>
                      <CardDescription className="font-brand-tertiary text-base mt-2">
                        Digite seu número de telefone para criar ou acessar sua conta.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="font-brand-tertiary font-medium">Telefone</Label>
                          <Controller
                            name="phone"
                            control={phoneForm.control}
                            render={({ field }) => (
                              <PhoneInput
                                id="phone"
                                value={field.value}
                                onChange={field.onChange}
                                className="border-2 focus:border-primary focus:ring-primary"
                              />
                            )}
                          />
                          {phoneForm.formState.errors.phone && (
                            <p className="text-sm text-destructive font-brand-tertiary">{phoneForm.formState.errors.phone.message}</p>
                          )}
                        </div>
                        <Button type="submit" className="w-full font-brand font-bold text-base transition-transform hover:scale-105 shadow-lg" disabled={isLoading}>
                          {isLoading ? 'Enviando código...' : 'Continuar'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-2 border-primary/20 shadow-lg">
                    <CardHeader>
                      <CardTitle className="font-brand font-bold text-2xl tracking-wide">
                        Verifique seu número
                      </CardTitle>
                      <CardDescription className="font-brand-tertiary text-base mt-2">
                        Digite o código de verificação que você recebeu no {formatPhoneDisplay(phoneNumber)}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-6">
                        <div className="space-y-2">
                          <Label className="font-brand-tertiary font-medium text-center block">Código de verificação</Label>
                          <div className="flex justify-center">
                            <Controller
                              name="otp"
                              control={otpForm.control}
                              render={({ field }) => (
                                <InputOTP
                                  maxLength={6}
                                  {...field}
                                  disabled={isVerifying}
                                >
                                  <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                  </InputOTPGroup>
                                </InputOTP>
                              )}
                            />
                          </div>
                          {otpForm.formState.errors.otp && (
                            <p className="text-sm text-destructive font-brand-tertiary text-center">
                              {otpForm.formState.errors.otp.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Button
                            type="submit"
                            className="w-full font-brand font-bold text-base transition-transform hover:scale-105 shadow-lg"
                            disabled={isVerifying || otpForm.watch('otp')?.length !== 6}
                          >
                            {isVerifying ? 'Verificando...' : 'Verificar código'}
                          </Button>

                          <div className="flex flex-col items-center gap-2">
                            {countdown > 0 ? (
                              <p className="text-sm text-muted-foreground font-brand-tertiary">
                                Reenviar código em {countdown}s
                              </p>
                            ) : (
                              <Button
                                type="button"
                                variant="link"
                                onClick={handleResendOtp}
                                disabled={isLoading}
                                className="font-brand-tertiary text-sm"
                              >
                                {isLoading ? 'Enviando...' : 'Reenviar código'}
                              </Button>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            onClick={handleBackToPhone}
                            className="w-full font-brand-tertiary text-sm"
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar e alterar telefone
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
