export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan_type: string | null;
  trial_start: string;
  trial_end: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  status: string;
  trialDaysLeft: number;
  trialExpired: boolean;
  canAddEntries: boolean;
  isTrial?: boolean;
  planType?: string | null;
}

export const PLANS = {
  monthly: {
    name: "Mensal",
    price: "R$ 29,90",
    priceValue: 29.9,
    period: "/mês",
    planType: "monthly" as const,
  },
  yearly: {
    name: "Anual",
    price: "R$ 19,90",
    priceValue: 19.9,
    period: "/mês",
    totalPrice: "R$ 238,80/ano",
    planType: "yearly" as const,
    savings: "Economize 30%",
  },
} as const;
