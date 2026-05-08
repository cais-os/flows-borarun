// Type declarations for global tracking functions
declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
        fbq?: (...args: any[]) => void;
        dataLayer?: any[];
    }
}

export interface TrackOptions {
    eventName: string;
    category?: string; // Category of the event (e.g., 'landing', 'auth', 'onboarding', 'training', etc.)
    userId: string;
    origin?: string; // e.g. 'app', 'whatsapp', 'web', 'mobile', 'backend' (default: 'app')
    metadata?: Record<string, any>;
    unique?: boolean; // Se true, verifica se evento já existe para o user_id antes de trackear (default: false)
    channels?: {
        database?: boolean;           // Salvar no events (default: true)
        ga4?: boolean | string;      // Google Analytics 4 (true = usa eventName, string = override)
        metaPixel?: boolean | string; // Meta Pixel (true = usa eventName, string = override)
        webhook?: boolean | string;   // Webhook N8n (true = path `/${eventName}`, string = override path)
    };
}

