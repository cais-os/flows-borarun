ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS mp_subscription_id text,
  ADD COLUMN IF NOT EXISTS mp_subscription_status text,
  ADD COLUMN IF NOT EXISTS mp_authorized_payment_id text;

CREATE INDEX IF NOT EXISTS idx_payments_subscription
  ON payments(mp_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_authorized_payment
  ON payments(mp_authorized_payment_id);
