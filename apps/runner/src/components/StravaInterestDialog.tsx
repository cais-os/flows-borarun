import { useState } from 'react';
import { Activity, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StravaInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StravaInterestDialog = ({ open, onOpenChange }: StravaInterestDialogProps) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, informe seu email para receber atualizações",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('strava_interest')
        .insert({
          user_id: user?.id || null,
          email: email.trim(),
          message: message.trim() || null,
        });

      if (error) throw error;

      setIsSubmitted(true);

      toast({
        title: "Interesse registrado! 🎉",
        description: "Entraremos em contato quando a integração estiver disponível",
      });

      // Fechar o dialog após 2 segundos
      setTimeout(() => {
        onOpenChange(false);
        setIsSubmitted(false);
        setEmail('');
        setMessage('');
      }, 2000);

    } catch (error) {
      console.error('Erro ao registrar interesse:', error);
      toast({
        title: "Erro ao registrar interesse",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setIsSubmitted(false);
      setEmail('');
      setMessage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md rounded-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-orange-500" />
            </div>
            <DialogTitle className="text-lg">Em breve, lançaremos a Integração com Strava!</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Estamos trabalhando na integração com o Strava para importar automaticamente seus treinos e atividades.
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Interesse registrado!</h3>
            <p className="text-sm text-muted-foreground">
              Entraremos em contato quando a integração estiver disponível.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email *
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 border border-gray-300 dark:border-gray-600"
                  autoFocus={false}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium">
                Mensagem (opcional)
              </Label>
              <Textarea
                id="message"
                placeholder="Conte-nos como você gostaria de usar a integração com Strava..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="resize-none border border-gray-300 dark:border-gray-600 font-brand-tertiary text-base"
                autoFocus={false}
              />
            </div>

            <DialogFooter className="flex flex-row w-full items-center justify-center gap-3 px-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="min-w-[120px] font-primary tracking-wide uppercase"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[120px] font-primary tracking-wide uppercase font-semibold"
              >
                {isSubmitting ? 'Registrando...' : 'Quero ser notificado'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};