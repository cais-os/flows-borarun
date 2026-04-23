ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_checkout_id text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_status text,
  ADD COLUMN IF NOT EXISTS provider_invoice_id text;

UPDATE payments
SET provider = COALESCE(provider, 'mercado_pago'),
    provider_payment_id = COALESCE(provider_payment_id, mp_payment_id),
    provider_subscription_id = COALESCE(provider_subscription_id, mp_subscription_id),
    provider_subscription_status = COALESCE(provider_subscription_status, mp_subscription_status)
WHERE provider IS NULL
   OR provider_payment_id IS NULL
   OR provider_subscription_id IS NULL
   OR provider_subscription_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider
  ON payments(provider);

CREATE INDEX IF NOT EXISTS idx_payments_provider_checkout
  ON payments(provider_checkout_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_customer
  ON payments(provider_customer_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_payment
  ON payments(provider_payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_subscription
  ON payments(provider_subscription_id);
