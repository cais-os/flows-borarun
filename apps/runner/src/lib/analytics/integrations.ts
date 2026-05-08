import { supabase } from '@/integrations/supabase/client';
import type { TrackOptions } from './types';
import { getBrowserData } from './utils';

/**
 * Integrações de tracking
 * Inclui tracking no browser (client-side) e chamada para edge function (server-side)
 */

/**
 * Envia evento para Google Analytics 4 no browser
 */
export function sendToGA4(eventName: string, parameters?: Record<string, unknown>): void {
    try {
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', eventName, parameters || {});
        }
    } catch (error) {
        console.warn('Error tracking GA4 event:', error);
    }
}

/**
 * Envia evento para Meta Pixel no browser
 */
export function sendToMetaPixel(eventName: string, parameters?: Record<string, unknown>): void {
    try {
        if (typeof window !== 'undefined' && window.fbq) {
            window.fbq('track', eventName, parameters || {});
        }
    } catch (error) {
        console.warn('Error tracking Meta Pixel event:', error);
    }
}

/**
 * Chama a edge function track-event para server-side tracking
 * Edge function é responsável por salvar no banco, server-side tracking e webhooks
 * Permite chamadas sem userId para tracking anônimo (ex: landing page)
 */
export async function callTrackEventEdgeFunction(
    eventName: string,
    userId: string | undefined,
    options?: Partial<TrackOptions>
): Promise<void> {
    try {
        const browserData = getBrowserData();

        const payload = {
            eventName,
            category: options?.category,
            userId: userId || undefined, // Enviar undefined se não houver userId
            origin: options?.origin || 'app', // Default para 'app'
            metadata: options?.metadata,
            browserData,
            channels: options?.channels,
        };

        // Usar anon key se não houver userId (para permitir tracking anônimo)
        const { error } = await supabase.functions.invoke('track-event', {
            body: payload,
        });

        if (error) {
            console.error(`❌ Erro ao chamar edge function para ${eventName}:`, error);
        } else {
            console.log(`✅ Edge function chamada com sucesso para ${eventName}`, userId ? `(user: ${userId})` : '(anonymous)');
        }
    } catch (error) {
        console.error(`❌ Erro ao chamar edge function para ${eventName}:`, error);
    }
}

