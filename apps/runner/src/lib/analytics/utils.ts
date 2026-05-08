/**
 * Utilitários para analytics
 */

export interface BrowserData {
    user_agent?: string;
    client_id?: string;
    fbp?: string;
}

/**
 * Obtém dados do browser para enviar para edge function
 * Captura user agent, GA4 client_id e Meta Pixel browser ID
 */
export function getBrowserData(): BrowserData {
    if (typeof window === 'undefined') {
        return {};
    }

    const browserData: BrowserData = {};

    // User Agent
    browserData.user_agent = navigator.userAgent;

    // GA4 Client ID - tentar obter do cookie _ga
    if (window.gtag) {
        try {
            // gtag('get', 'clientId') não está disponível diretamente, então tentamos do cookie
            const gaCookie = document.cookie
                .split('; ')
                .find(row => row.startsWith('_ga='));
            if (gaCookie) {
                // Formato: _ga=GA1.1.XXXXXXXXX.XXXXXXXXX
                const parts = gaCookie.split('.');
                if (parts.length >= 4) {
                    browserData.client_id = `${parts[2]}.${parts[3]}`;
                }
            }
        } catch (error) {
            console.warn('Error getting GA4 client_id:', error);
        }
    }

    // Meta Pixel Browser ID (fbp) - do cookie _fbp
    const fbpCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('_fbp='));
    if (fbpCookie) {
        browserData.fbp = fbpCookie.split('=')[1];
    }

    return browserData;
}

