ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS subscription_nudge_message text;
