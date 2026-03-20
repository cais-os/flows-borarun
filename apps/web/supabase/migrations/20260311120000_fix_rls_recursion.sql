-- Fix: remove RLS policies that cause infinite recursion on organization_members

DROP POLICY IF EXISTS "Org members can read flow_executions" ON flow_executions;
DROP POLICY IF EXISTS "Org members can read flow_node_events" ON flow_node_events;
DROP POLICY IF EXISTS "Service role full access on flow_executions" ON flow_executions;
DROP POLICY IF EXISTS "Service role full access on flow_node_events" ON flow_node_events;

ALTER TABLE flow_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE flow_node_events DISABLE ROW LEVEL SECURITY;
