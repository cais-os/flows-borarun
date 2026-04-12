-- Harden organization settings access and add Mercado Pago webhook secret storage.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS mercado_pago_webhook_secret text;

DROP POLICY IF EXISTS organization_settings_member_access ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_owner_access ON public.organization_settings;

CREATE POLICY organization_settings_owner_access
ON public.organization_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1
      FROM public.organization_members AS members
     WHERE members.organization_id = organization_settings.organization_id
       AND members.user_id = auth.uid()
       AND members.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM public.organization_members AS members
     WHERE members.organization_id = organization_settings.organization_id
       AND members.user_id = auth.uid()
       AND members.role = 'owner'
  )
);
