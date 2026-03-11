-- Fix: organization_members RLS policy references itself causing infinite recursion.
-- Replace the self-referencing subquery with a direct user_id check.

DROP POLICY IF EXISTS organization_members_member_access ON public.organization_members;

CREATE POLICY organization_members_member_access
ON public.organization_members
FOR SELECT
USING (user_id = auth.uid());

-- Also allow members to manage their own org (insert/update/delete for owners)
DROP POLICY IF EXISTS organization_members_manage ON public.organization_members;

CREATE POLICY organization_members_manage
ON public.organization_members
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
