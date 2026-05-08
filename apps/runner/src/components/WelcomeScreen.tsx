import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles, Activity, CalendarDays, X, ArrowLeft } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

import HeroOne from "@/assets/images/borarun-1.png";
import HeroOneVideo from "@/assets/images/borarun-1-video.mp4";
import PlaceholderImg from "@/assets/images/borarun-6.png";
import PlaceholderVideo from "@/assets/images/borarun-6-video.mp4";
import HeroThree from "@/assets/images/borarun-7.png";
import HeroThreeVideo from "@/assets/images/borarun-7-video.mp4";

interface WelcomeScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkSeen: () => Promise<void>;
  isMarking?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  open,
  onOpenChange,
  onMarkSeen,
  isMarking = false,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isClosing, setIsClosing] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(
    () => [
      { key: "welcome", type: "hero" as const },
      { key: "features", type: "features" as const },
      { key: "pricing", type: "pricing" as const },
    ],
    [],
  );

  const features = useMemo(
    () => [
      {
        icon: MessageCircle,
        title: "Conheça o Vini",
        description: "Seu treinador no WhatsApp.",
      },
      {
        icon: CalendarDays,
        title: "Plano dinâmico",
        description: "Seu plano de corrida se adapta a você.",
      },
      {
        icon: Activity,
        title: "Integração Strava",
        description: "Registre treinos automaticamente.",
      },
    ],
    [],
  );

  const trackWelcome = useCallback(
    (eventName: string, metadata?: Record<string, unknown>, options?: { unique?: boolean }) => {
      void track(eventName, user?.id, {
        unique: options?.unique,
        metadata: {
          slide_index: currentSlide,
          slide_key: slides[currentSlide]?.key,
          ...metadata,
        },
      }).catch((error) => console.error(`Erro ao rastrear evento ${eventName}:`, error));
    },
    [currentSlide, slides, user?.id],
  );

  const handleClose = useCallback(async (reason?: "x" | "start" | "auto_next" | "dialog_close") => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      await onMarkSeen();
      trackWelcome("activity_welcome_screen_viewed", { reason }, { unique: true });
    } catch (error) {
      console.error("Erro ao finalizar welcome screen:", error);
    } finally {
      onOpenChange(false);
      setIsClosing(false);
    }
  }, [isClosing, onMarkSeen, onOpenChange, trackWelcome]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrentSlide(api.selectedScrollSnap());
    api.on("select", onSelect);
    setCurrentSlide(api.selectedScrollSnap());
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (api && open) {
      api.scrollTo(0);
      setCurrentSlide(0);
    }
  }, [api, open]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      api?.scrollNext();
    } else {
      handleClose("auto_next");
    }
  };

  const handlePrevious = () => {
    api?.scrollPrev();
  };

  const handleContinueClick = () => {
    trackWelcome("activity_welcome_screen_continue", { from_slide: currentSlide });
    handleNext();
  };

  const handleStartClick = async () => {
    trackWelcome("activity_welcome_screen_continue", { from_slide: currentSlide, label: "COMEÇAR" });
    await handleClose("start");
    navigate("/subscription");
  };

  const handleBackClick = () => {
    trackWelcome("activity_welcome_screen_back", { from_slide: currentSlide });
    handlePrevious();
  };

  const handleXClick = () => {
    trackWelcome("activity_welcome_screen_close", { from_slide: currentSlide });
    handleClose("x");
  };

  const renderDots = () => {
    const total = slides.length;
    return (
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => api?.scrollTo(index)}
            className={`h-2 w-2 rounded-full transition-all ${index === currentSlide ? "bg-white" : "bg-white/40"
              }`}
            aria-label={`Ir para slide ${index + 1}`}
          />
        ))}
      </div>
    );
  };

  const bottomCtaLabel = currentSlide === slides.length - 1 ? "Começar" : "Continuar";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? handleClose("dialog_close") : onOpenChange(isOpen))}>
      <DialogContent
        hideClose
        className="fixed inset-0 z-50 m-0 h-[100dvh] max-h-[100dvh] w-[100vw] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-none bg-transparent p-0 sm:p-0"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        {/*
          Botão de fechar (X) (temporariamente desativado):
          <button
            onClick={handleXClick}
            disabled={isMarking || isClosing}
            className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        */}

        <Carousel setApi={setApi} className="h-[100dvh] w-full overflow-hidden">
          <CarouselContent className="h-[100dvh] ml-0 w-full [&>*]:pl-0">
            <CarouselItem className="h-[100dvh] basis-full pl-0 overflow-hidden">
              <div className="relative flex h-full min-h-[100dvh] w-full flex-col">
                <div className="absolute inset-0">
                  <video
                    className="absolute inset-0 h-full w-full object-cover"
                    src={HeroOneVideo}
                    poster={HeroOne}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    disablePictureInPicture
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/50 to-transparent" />
                </div>
                <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-12 pt-16 text-white">
                  <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-between">
                    <div className="flex flex-1 items-center justify-center">
                      <p className="text-5xl font-bold font-brand-secondary tracking-tight" style={{ color: '#daf46c' }}>bora?</p>
                    </div>
                    <div className="space-y-6">
                      <p className="text-center text-base text-white/80">Corra hoje mesmo com um plano feito sob medida para você.</p>
                      {renderDots()}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          className="flex-1 bg-white/15 text-white backdrop-blur"
                          onClick={handleContinueClick}
                          disabled={isMarking || isClosing}
                        >
                          {bottomCtaLabel}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="h-[100dvh] basis-full pl-0 overflow-hidden">
              <div className="relative flex h-full min-h-[100dvh] w-full flex-col">
                <div className="absolute inset-0">
                  <video
                    className="absolute inset-0 h-full w-full object-cover object-center scale-[1.35]"
                    src={PlaceholderVideo}
                    poster={PlaceholderImg}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    disablePictureInPicture
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
                </div>
                <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-12 pt-16 text-white">
                  <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-between">
                    <div className="space-y-4 my-auto">
                      <h2 className="text-3xl font-bold text-white">Tudo que importa para evoluir</h2>
                      <div className="space-y-3">
                        {features.map((feature, index) => {
                          const Icon = feature.icon;
                          return (
                            <div
                              key={index}
                              className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-sm backdrop-blur"
                            >
                              <div className="mt-1">
                                <Icon className="h-5 w-5 text-white" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-white">{feature.title}</p>
                                <p className="text-sm text-white/80">{feature.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-6">
                      {renderDots()}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          className="h-10 w-10 rounded-full bg-white/15 p-0 text-white backdrop-blur"
                          onClick={handleBackClick}
                          disabled={isMarking || isClosing}
                          aria-label="Voltar"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1 bg-white/15 text-white backdrop-blur"
                          onClick={handleContinueClick}
                          disabled={isMarking || isClosing}
                        >
                          {bottomCtaLabel}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="h-[100dvh] basis-full pl-0 overflow-hidden">
              <div className="relative flex h-full min-h-[100dvh] w-full flex-col">
                <div className="absolute inset-0">
                  <video
                    className="absolute inset-0 h-full w-full object-cover"
                    src={HeroThreeVideo}
                    poster={HeroThree}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    disablePictureInPicture
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent" />
                </div>
                <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-12 pt-16 text-white">
                  <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-between">
                    <div className="space-y-4 mt-auto mb-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Oferta de lançamento</p>
                      <div className="space-y-2">
                        <p className="text-base text-white/80 line-through">R$29,90/mês</p>
                        <p className="text-4xl font-bold leading-tight">R$0</p>
                        <p className="text-lg font-semibold text-white">Teste grátis por 7 dias</p>
                      </div>
                      <p className="text-sm text-white/75">
                        Cancele a qualquer momento. Sem compromisso.
                      </p>
                    </div>
                    <div className="space-y-6">
                      {renderDots()}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          className="h-10 w-10 rounded-full bg-white/15 p-0 text-white backdrop-blur"
                          onClick={handleBackClick}
                          disabled={isMarking || isClosing}
                          aria-label="Voltar"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          className="flex-1 font-brand font-bold"
                          onClick={handleStartClick}
                          disabled={isMarking || isClosing}
                        >
                          COMEÇAR
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </DialogContent>
    </Dialog>
  );
};