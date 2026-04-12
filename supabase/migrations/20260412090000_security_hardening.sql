-- Security hardening for multi-tenant access control and sensitive tables.

-- Users should not be able to create/update/delete organization memberships
-- directly from the client. Membership writes happen through privileged flows.
DROP POLICY IF EXISTS organization_members_manage ON public.organization_members;

-- Re-enable RLS on analytics tables and restrict reads to members of the same org.
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_node_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read flow_executions" ON public.flow_executions;
CREATE POLICY "Org members can read flow_executions"
ON public.flow_executions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
      FROM public.organization_members AS members
     WHERE members.organization_id = flow_executions.organization_id
       AND members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can read flow_node_events" ON public.flow_node_events;
CREATE POLICY "Org members can read flow_node_events"
ON public.flow_node_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
      FROM public.organization_members AS members
     WHERE members.organization_id = flow_node_events.organization_id
       AND members.user_id = auth.uid()
  )
);

-- Payments contain billing data and must be isolated per organization.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_member_access ON public.payments;
CREATE POLICY payments_member_access
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
      FROM public.organization_members AS members
     WHERE members.organization_id = payments.organization_id
       AND members.user_id = auth.uid()
  )
);
