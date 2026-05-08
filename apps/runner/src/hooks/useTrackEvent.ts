import { useCallback } from 'react';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook that wraps track() function and automatically gets userId
 * Makes it easier to track events in components
 */
export const useTrackEvent = () => {
  const { user } = useAuth();

  const trackEvent = useCallback(
    (
      eventName: string,
      options?: {
        category?: string;
        metadata?: Record<string, unknown>;
        channels?: {
          database?: boolean;
          ga4?: boolean | string;
          metaPixel?: boolean | string;
          webhook?: boolean | string;
        };
      }
    ) => {
      if (user?.id) {
        track(eventName, user.id, options);
      } else {
        console.warn(`[useTrackEvent] No user ID available for event: ${eventName}`);
      }
    },
    [user?.id]
  );

  return { trackEvent };
};

