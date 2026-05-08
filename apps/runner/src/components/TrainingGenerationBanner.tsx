import React, { useState, useEffect } from "react";
import { Loader2, Sparkles, Target, Calendar, Zap, User, Heart, Clock, TrendingUp, Activity, Brain, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const STORAGE_KEY = 'training_generation_start_time';
const DURATION = 60000; // 60 segundos (1 minuto)
const TARGET_PROGRESS = 95;

interface TrainingGenerationBannerProps {
    isGenerating?: boolean;
}

export const TrainingGenerationBanner = ({ isGenerating = true }: TrainingGenerationBannerProps) => {
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [stepOpacity, setStepOpacity] = useState(1);

    const steps = [
        { icon: User, text: "Analisando seu perfil" },
        { icon: Target, text: "Definindo objetivos de corrida" },
        { icon: Heart, text: "Calculando capacidade cardiovascular" },
        { icon: Calendar, text: "Criando cronograma semanal" },
        { icon: Clock, text: "Definindo durações ideais" },
        { icon: Zap, text: "Personalizando intensidades" },
        { icon: TrendingUp, text: "Planejando progressão gradual" },
        { icon: Activity, text: "Balanceando tipos de treino" },
        { icon: Brain, text: "Aplicando princípios científicos" },
        { icon: CheckCircle, text: "Finalizando plano personalizado" }
    ];

    // Limpar localStorage quando a geração for concluída
    useEffect(() => {
        if (!isGenerating) {
            localStorage.removeItem(STORAGE_KEY);
            setProgress(0);
            setCurrentStep(0);
            setStepOpacity(1);
        }
    }, [isGenerating]);

    useEffect(() => {
        if (!isGenerating) {
            return; // Não executar animação se não estiver gerando
        }

        // Restaurar progresso do localStorage ou iniciar novo
        const savedStartTime = localStorage.getItem(STORAGE_KEY);

        let startTime: number;
        let initialProgress = 0;
        let initialStep = 0;

        if (savedStartTime) {
            // Restaurar progresso existente baseado no tempo decorrido
            startTime = parseInt(savedStartTime);
            const elapsed = Date.now() - startTime;

            // Se passou muito tempo (mais de 1.5 minutos), reiniciar
            if (elapsed > DURATION * 1.5) {
                startTime = Date.now();
                localStorage.setItem(STORAGE_KEY, startTime.toString());
                initialProgress = 0;
                initialStep = 0;
            } else {
                // Calcular progresso baseado no tempo decorrido
                const calculatedProgress = Math.min((elapsed / DURATION) * TARGET_PROGRESS, TARGET_PROGRESS);
                initialProgress = calculatedProgress;

                // Restaurar step baseado no tempo (cada step leva ~6 segundos para 10 steps em 60s)
                const stepInterval = DURATION / steps.length;
                initialStep = Math.floor(elapsed / stepInterval) % steps.length;
            }
        } else {
            // Iniciar nova animação
            startTime = Date.now();
            localStorage.setItem(STORAGE_KEY, startTime.toString());
        }

        setProgress(initialProgress);
        setCurrentStep(initialStep);

        // Animar a barra de progresso continuando de onde parou
        const interval = 50; // Atualizar a cada 50ms para suavidade
        const increment = (TARGET_PROGRESS / DURATION) * interval;

        const progressTimer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const calculatedProgress = Math.min((elapsed / DURATION) * TARGET_PROGRESS, TARGET_PROGRESS);

            setProgress(calculatedProgress);

            if (calculatedProgress >= TARGET_PROGRESS) {
                clearInterval(progressTimer);
            }
        }, interval);

        // Animar os passos com fade-in/fade-out cíclico
        // Intervalo fixo de ~6 segundos por step (60s / 10 steps = 6s)
        const stepIntervalMs = DURATION / steps.length; // ~6000ms por step

        const animateSteps = () => {
            // Fade out atual (1 segundo)
            setStepOpacity(0);

            setTimeout(() => {
                // Mudar para próximo passo
                setCurrentStep(prev => (prev + 1) % steps.length);

                // Fade in novo passo (1 segundo)
                setTimeout(() => {
                    setStepOpacity(1);
                }, 50); // Pequeno delay para garantir que o estado mudou
            }, 1000); // Aguardar fade out completo
        };

        // Iniciar animação dos passos com intervalo fixo
        const stepTimer = setInterval(animateSteps, stepIntervalMs);

        return () => {
            clearInterval(progressTimer);
            clearInterval(stepTimer);
        };
    }, [steps.length, isGenerating]);

    return (
        <Card className="border-none shadow-sm bg-primary rounded-[20px] p-4 mb-4 pt-6">
            <div className="text-center space-y-6">
                <div>
                    <h3 className="text-lg font-brand text-center mb-2 text-black tracking-wide">
                        Gerando seu treino personalizado!
                    </h3>
                    <p className="text-sm font-brand-tertiary mb-4 text-black">
                        Estamos criando um plano de corrida único baseado nas suas informações e objetivos.
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-center space-x-2 text-black h-6 min-h-[24px] py-8">
                        {steps.map((step, index) => {
                            const IconComponent = step.icon;
                            return (
                                <div
                                    key={index}
                                    className={`flex items-center space-x-2 transition-opacity duration-1000 ease-in-out ${index === currentStep ? '' : 'absolute'
                                        }`}
                                    style={{
                                        opacity: index === currentStep ? stepOpacity : 0
                                    }}
                                >
                                    <IconComponent className="w-4 h-4 text-black" />
                                    <span className="text-sm font-brand tracking-wide font-normal text-black">{step.text}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-center space-x-2 text-black">
                        <Loader2 className="w-3 h-3 animate-spin text-black/60" />
                        <span className="text-xs font-brand-tertiary text-black/60">Isso pode levar até 1 minuto...</span>
                    </div>

                    <div className="w-full bg-white rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-black to-black/70 h-2 rounded-full transition-all duration-100 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

