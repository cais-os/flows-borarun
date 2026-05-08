import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Download, MessageSquare, Trophy } from "lucide-react";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PLANS } from "@/types/subscription";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { track } from "@/lib/analytics";
import videoBg from "@/assets/images/borarun-9.mp4";
import image1 from "@/assets/images/borarun-5.png";
import image2 from "@/assets/images/borarun-2.png";
import image3 from "@/assets/images/borarun-4.png";
import image4 from "@/assets/images/borarun-7.png";
import ctaImage from "@/assets/images/borarun-3.png";

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);
  const pricingRef = useRef(null);
  const ctaRef = useRef(null);

  const heroInView = useInView(heroRef, { once: true, amount: 0.3 });
  const featuresInView = useInView(featuresRef, { once: true, amount: 0.2 });
  const howItWorksInView = useInView(howItWorksRef, { once: true, amount: 0.2 });
  const pricingInView = useInView(pricingRef, { once: true, amount: 0.2 });
  const ctaInView = useInView(ctaRef, { once: true, amount: 0.3 });

  useEffect(() => {
    // Redirect authenticated users to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Track landing page opened (once per session)
  useEffect(() => {
    const LANDING_OPENED_KEY = 'landing_page_opened_tracked';

    // Check if already tracked in this session
    if (sessionStorage.getItem(LANDING_OPENED_KEY) === 'true') {
      return;
    }

    // Mark as tracked
    sessionStorage.setItem(LANDING_OPENED_KEY, 'true');

    track('landing_page_opened', undefined, {
      metadata: {
        path: window.location.pathname,
        referrer: document.referrer || 'direct'
      }
    });
  }, []);

  // Track scroll once per session
  useEffect(() => {
    const SCROLL_TRACKED_KEY = 'landing_scroll_tracked';

    // Check if already tracked in this session
    if (sessionStorage.getItem(SCROLL_TRACKED_KEY) === 'true') {
      return;
    }

    let hasTracked = false;
    const handleScroll = () => {
      // Only track once, even if user scrolls multiple times
      if (hasTracked) return;

      // Track when user scrolls (even a small amount)
      hasTracked = true;
      sessionStorage.setItem(SCROLL_TRACKED_KEY, 'true');

      track('landing_scrolled', undefined, {
        metadata: { scroll_position: window.scrollY }
      });

      // Remove listener after tracking
      window.removeEventListener('scroll', handleScroll);
    };

    // Use passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const features = [
    {
      title: "planos personalizados",
      image: image1,
    },
    {
      title: "integração com Strava",
      image: image2,
    },
    {
      title: "análise de desempenho",
      image: image3,
    },
    {
      title: "objetivos realistas",
      image: image4,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Floating with Glass Morphism */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-4 left-4 right-4 z-50 pt-safe"
      >
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-2xl border px-6 py-4 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(218,244,108,0.1))',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderColor: 'rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
            }}
          >
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="font-brand text-2xl font-black tracking-tight"
                style={{ color: '#daf46c', textShadow: '0 0 20px rgba(218,244,108,0.5)' }}
              >
                BORARUN
              </motion.div>
              <Button
                onClick={() => {
                  track('landing_cta_navbar', undefined, {
                    metadata: { location: 'header', cta_text: 'COMEÇAR' },
                    channels: { ga4: 'generate_lead', metaPixel: 'Lead' }
                  });
                  navigate("/auth?tab=signup");
                }}
                className="font-brand font-bold bg-primary text-black hover:bg-primary/90 transition-all hover:scale-105 shadow-lg tracking-wide"
              >
                COMEÇAR
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section ref={heroRef} className="relative min-h-[100vh] flex items-center overflow-hidden">
          {/* Background Video */}
          <motion.div
            className="absolute inset-0 z-0"
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <video
              src={videoBg}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          </motion.div>
          {/* Subtle dark overlay */}
          <div className="absolute inset-0 bg-black/30 z-10" />

          <div className="relative z-20 w-full flex items-center justify-center h-full">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-6xl md:text-7xl font-brand-secondary font-bold"
              style={{ color: '#daf46c' }}
            >
              bora?
            </motion.h1>
          </div>
        </section>

        {/* About & Features Section */}
        <section ref={featuresRef} className="relative py-20 px-4 bg-black pl-safe pr-safe">
          <div className="max-w-6xl mx-auto">
            {/* About Content */}
            <div className="max-w-4xl mx-auto text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-4xl md:text-5xl font-brand font-bold mb-6 text-white">
                  O seu assessor de corrida pessoal
                </h2>
                <p className="text-lg md:text-xl text-white/70 font-brand-tertiary leading-relaxed mb-8 text-center">
                  Descubra sua melhor versão com uma plataforma inteligente que usa IA para criar planos de corrida totalmente personalizados.
                  Tenha treinos ajustados ao seu nível, objetivos e rotina, e receba orientações práticas do seu treinador virtual a cada etapa.
                </p>
              </motion.div>
            </div>

            {/* Features Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((feature, index) => {
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="relative group overflow-hidden rounded-2xl h-64"
                    whileHover={{ scale: 1.02 }}
                  >
                    {/* Background Image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url('${feature.image}')` }}
                    />

                    {/* Title - Centered */}
                    <div className="relative z-10 h-full flex items-center justify-center p-8">
                      <h3 className="font-brand-secondary text-3xl text-center font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" style={{ color: '#daf46c' }}>
                        {feature.title}
                      </h3>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          ref={howItWorksRef}
          className="relative px-4 bg-gradient-to-b from-black to-black/95 pl-safe pr-safe pt-10 lg:pt-20"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="text-4xl md:text-5xl font-brand font-bold mb-4 text-white"
              >
                Como Funciona?
              </motion.h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-center"
              >
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl"></div>
                    <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                      <Download className="w-10 h-10" style={{ color: '#daf46c' }} />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-brand font-bold mb-4 text-white">
                  PASSO 1
                </h3>
                <p className="text-lg md:text-xl text-white/70 font-brand-tertiary leading-relaxed mb-8 text-center">
                  Baixe o app ou fale com o assessor direto no WhatsApp
                </p>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-center"
              >
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl"></div>
                    <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                      <MessageSquare className="w-10 h-10" style={{ color: '#daf46c' }} />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-brand font-bold mb-4 text-white">
                  PASSO 2
                </h3>
                <p className="text-lg md:text-xl text-white/70 font-brand-tertiary leading-relaxed mb-8 text-center">
                  Responda perguntas sobre seus objetivos, nível atual e disponibilidade
                </p>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-center"
              >
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl"></div>
                    <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                      <Trophy className="w-10 h-10" style={{ color: '#daf46c' }} />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-brand font-bold mb-4 text-white">
                  PASSO 3
                </h3>
                <p className="text-lg md:text-xl text-white/70 font-brand-tertiary leading-relaxed mb-8 text-center">
                  Receba seu plano personalizado e acompanhe no app e WhatsApp
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section ref={pricingRef} className="px-4 py-20 pt-24 bg-black/95 pl-safe pr-safe">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={pricingInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="text-4xl font-brand font-bold mb-4 text-white"
              >
                Planos e Preços
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={pricingInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-white/70 font-brand-tertiary leading-relaxed mb-8 text-center"
              >
                Comece seu <span className="text-primary font-bold">teste gratuito de 7 dias</span> e receba seu plano personalizado.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Monthly Plan */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={pricingInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="p-8 bg-white hover:shadow-2xl hover:shadow-primary/20 transition-all relative border-2 border-gray-200">
                  <Badge className="absolute top-4 right-4 bg-primary text-black font-bold animate-pulse">
                    7 dias grátis
                  </Badge>
                  <div className="mb-4 h-6"></div>
                  <h4 className="text-2xl font-brand font-black mb-2">{PLANS.monthly.name}</h4>
                  <div className="mb-2">
                    <span className="text-4xl font-brand font-bold">{PLANS.monthly.price}</span>
                    <span className="text-muted-foreground font-brand-secondary">{PLANS.monthly.period}</span>
                  </div>
                  <div className="h-5 mb-6"></div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Planos de treino personalizados
                    </li>
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Dicas do treinador IA a cada treino
                    </li>
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Integração com Strava
                    </li>
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Acompanhamento de desempenho
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-primary text-black hover:bg-primary/90 transition-all hover:scale-105 font-bold font-brand"
                    size="lg"
                    onClick={() => {
                      track('landing_clicked_subscribe_monthly', undefined, {
                        metadata: { location: 'pricing_monthly', cta_text: 'COMEÇAR GRATUITAMENTE' },
                        channels: { ga4: 'begin_checkout', metaPixel: 'InitiateCheckout' }
                      });
                      navigate("/auth?tab=signup");
                    }}
                  >
                    COMEÇAR GRATUITAMENTE
                  </Button>
                </Card>
              </motion.div>

              {/* Yearly Plan */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={pricingInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Card className="p-8 bg-white hover:shadow-2xl hover:shadow-primary/20 transition-all border-2 border-primary relative">
                  <Badge className="mb-4 bg-primary text-black font-bold">MAIS POPULAR</Badge>
                  <Badge className="absolute top-4 right-4 bg-primary text-black font-bold animate-pulse">
                    7 dias grátis
                  </Badge>
                  <h4 className="text-2xl font-brand font-black mb-2">{PLANS.yearly.name}</h4>
                  <div className="mb-2">
                    <span className="text-4xl font-brand font-bold">{PLANS.yearly.price}</span>
                    <span className="text-muted-foreground font-brand-secondary">{PLANS.yearly.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 font-brand-tertiary">{PLANS.yearly.totalPrice}</p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Planos de treino personalizados
                    </li>
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Dicas do treinador IA a cada treino
                    </li>
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Integração com Strava
                    </li>
                    <li className="flex items-center gap-2 text-sm font-brand-tertiary">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      Acompanhamento de desempenho
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-primary text-black hover:bg-primary/90 transition-all hover:scale-105 font-bold font-brand"
                    size="lg"
                    onClick={() => {
                      track('landing_clicked_subscribe_yearly', undefined, {
                        metadata: { location: 'pricing_yearly', cta_text: 'COMECE GRATUITAMENTE' },
                        channels: { ga4: 'begin_checkout', metaPixel: 'InitiateCheckout' }
                      });
                      navigate("/auth?tab=signup");
                    }}
                  >
                    COMECE GRATUITAMENTE
                  </Button>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section ref={ctaRef} className="relative min-h-[70vh] flex items-center overflow-hidden px-4 pl-safe pr-safe">
          {/* Dynamic Background */}
          <motion.div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `url('${ctaImage}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          {/* Gradient overlay with brand colors */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-primary/30 to-transparent z-10" />

          <div className="relative z-20 w-full max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={ctaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-black/40 backdrop-blur-sm rounded-3xl p-12 md:p-16 border border-primary/20"
            >
              <motion.h2
                initial={{ opacity: 0, scale: 0.9 }}
                animate={ctaInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-4xl md:text-5xl font-brand font-bold mb-6 text-white"
              >
                Pronto para sua primeira corrida?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={ctaInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-lg md:text-xl text-white/70 font-brand-tertiary leading-relaxed mb-8 text-center"
              >
                Dê o primeiro passo! Crie agora seu plano de corrida personalizado. Bora?
              </motion.p>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex justify-center"
              >
                <Button
                  size="lg"
                  onClick={() => {
                    track('landing_cta_banner', undefined, {
                      metadata: { location: 'cta_section', cta_text: 'COMEÇAR' },
                      channels: { ga4: 'generate_lead', metaPixel: 'Lead' }
                    });
                    navigate("/auth?tab=signup");
                  }}
                  className="text-xl px-12 py-8 h-auto font-bold bg-primary text-black hover:bg-primary/90 transition-all shadow-2xl hover:shadow-primary/50 font-brand"
                >
                  COMEÇAR
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-primary/20 py-8 pb-safe bg-black">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-white/60 pl-safe pr-safe font-brand-tertiary">
            <p>© 2025 BORARUN. Todos os direitos reservados.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
