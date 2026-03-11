-- Mercado Pago integration: credentials + payments table

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS mercado_pago_access_token text,
  ADD COLUMN IF NOT EXISTS mercado_pago_public_key text;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  mp_preference_id text NOT NULL,
  mp_payment_id text,
  plan_name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  duration_days int NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_conversation ON payments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_preference ON payments(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_payments_mp_payment ON payments(mp_payment_id);

ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
