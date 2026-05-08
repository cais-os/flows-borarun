import './types'; // Import types to register global declarations
import type { TrackOptions } from './types';
import { sendToGA4, sendToMetaPixel, callTrackEventEdgeFunction } from './integrations';
import { supabase } from '@/integrations/supabase/client';

/**
 * Função unificada para tracking de eventos de marketing
 * @param eventName - Nome do evento (ex: 'onboarding_started', 'login')
 * @param userId - ID do usuário (opcional para tracking anônimo, ex: landing page)
 * @param options - Opções customizadas (metadata e channels)
 */
export async function track(
    eventName: string,
    userId: string | undefined,
    options?: Partial<TrackOptions>
): Promise<void> {
    // Verificar se evento já existe quando unique=true e userId está presente
    if (options?.unique === true && userId) {
        try {
            const { data } = await supabase
                .schema('marketing')
                .from('events')
                .select('id')
                .eq('user_id', userId)
                .eq('event_name', eventName)
                .limit(1)
                .maybeSingle();

            if (data) {
                // Evento já existe, não proceder com o tracking
                console.log(`⏭️ Evento ${eventName} já existe para user ${userId}, pulando tracking`);
                return;
            }
        } catch (error) {
            // Em caso de erro na verificação, logar mas continuar com o tracking
            console.warn(`⚠️ Erro ao verificar unicidade do evento ${eventName}:`, error);
        }
    }

    const metadata = options?.metadata;

    // Executar todos os canais em paralelo
    const promises: Promise<void>[] = [];

    // 1. Enviar para Google Analytics 4 no browser (para dados do browser)
    // Só envia se channels.ga4 for explicitamente habilitado (true ou string)
    const ga4Value = options?.channels?.ga4;
    if (ga4Value === true || typeof ga4Value === 'string') {
        const ga4EventName = typeof ga4Value === 'string'
            ? ga4Value
            : eventName;
        promises.push(
            Promise.resolve().then(() => {
                try {
                    sendToGA4(ga4EventName, metadata);
                    console.log(`✅ Evento ${ga4EventName} enviado para GA4 (browser)`);
                } catch (error) {
                    console.error(`❌ Erro ao enviar ${ga4EventName} para GA4:`, error);
                }
            })
        );
    }

    // 2. Enviar para Meta Pixel no browser (para dados do browser)
    // Só envia se channels.metaPixel for explicitamente habilitado (true ou string)
    const metaValue = options?.channels?.metaPixel;
    if (metaValue === true || typeof metaValue === 'string') {
        const metaEventName = typeof metaValue === 'string'
            ? metaValue
            : eventName;
        promises.push(
            Promise.resolve().then(() => {
                try {
                    sendToMetaPixel(metaEventName, metadata);
                    console.log(`✅ Evento ${metaEventName} enviado para Meta Pixel (browser)`);
                } catch (error) {
                    console.error(`❌ Erro ao enviar ${metaEventName} para Meta Pixel:`, error);
                }
            })
        );
    }

    // 3. Chamar edge function sempre
    // Edge function usa EVENT_CHANNELS como fonte única de verdade para decidir.
    // Pode receber channels customizados via options.channels para override
    promises.push(
        callTrackEventEdgeFunction(eventName, userId, options).catch((error) => {
            console.error(`❌ Erro ao chamar edge function para ${eventName}:`, error);
        })
    );

    // Aguardar todos os canais executarem (independentemente de sucesso/falha)
    await Promise.allSettled(promises);
}
