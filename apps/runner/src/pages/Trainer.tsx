import { useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Target, Activity, MessageCircle } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

const Trainer = () => {
    const { user } = useAuth();
    
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleWhatsAppClick = () => {
        // Track speak with trainer
        if (user?.id) {
            track('activity_clicked_speak_with_trainer', user.id);
        }
        
        const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER;

        if (!whatsappNumber) {
            console.error('VITE_WHATSAPP_NUMBER não está configurada');
            return;
        }

        const whatsappUrl = `https://wa.me/${whatsappNumber}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-background pb-nav">
            <AppHeader />
            <div className="max-w-md mx-auto p-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-brand font-bold tracking-wide">
                            Falar com o Treinador
                        </CardTitle>
                        <CardDescription className="text-base font-brand-tertiary mb-4">
                            Converse diretamente com seu treinador de corrida pelo WhatsApp.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-6 mb-7">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Clock className="w-5 h-5" style={{ color: '#25D366' }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-brand-tertiary font-semibold text-foreground">
                                        Respostas Rápidas
                                    </p>
                                    <p className="text-sm text-muted-foreground font-brand-tertiary">
                                        Receba respostas imediatas às suas dúvidas sobre treinos e técnicas
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Target className="w-5 h-5" style={{ color: '#25D366' }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-brand-tertiary font-semibold text-foreground">
                                        Orientação Personalizada
                                    </p>
                                    <p className="text-sm text-muted-foreground font-brand-tertiary">
                                        Ajustes de treino adaptados ao seu nível e objetivos específicos
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Activity className="w-5 h-5" style={{ color: '#25D366' }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-brand-tertiary font-semibold text-foreground">
                                        Acompanhamento em Tempo Real
                                    </p>
                                    <p className="text-sm text-muted-foreground font-brand-tertiary">
                                        Monitore seu progresso e receba feedback constante sobre sua evolução
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleWhatsAppClick}
                            className="w-full font-brand font-bold tracking-wide uppercase"
                            style={{ backgroundColor: '#25D366', color: '#ffffff' }}
                            size="lg"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-5 h-5 mr-2"
                            >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            Falar com Treinador
                        </Button>
                    </CardContent>
                </Card>
            </div>
            <BottomNav activeTab="treinador" />
        </div>
    );
};

export default Trainer;

