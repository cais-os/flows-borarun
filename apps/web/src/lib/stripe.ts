import Stripe from "stripe";

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string | null;
};

export function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;

  if (!secretKey) {
    return {
      configured: false as const,
      config: null,
    };
  }

  return {
    configured: true as const,
    config: {
      secretKey,
      webhookSecret,
    } satisfies StripeConfig,
  };
}

let cachedStripe: Stripe | null = null;

export function getStripeClient() {
  const stripeConfig = getStripeConfig();
  if (!stripeConfig.configured || !stripeConfig.config) {
    throw new Error("Stripe is not configured");
  }

  if (!cachedStripe) {
    cachedStripe = new Stripe(stripeConfig.config.secretKey);
  }

  return cachedStripe;
}
