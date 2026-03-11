-- Analytics tracking: flow executions, node events, and per-contact subscriptions

-- 1. Subscription fields on conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS subscription_plan text,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_renewed_count int NOT NULL DEFAULT 0;

-- 2. Flow executions
CREATE TABLE IF NOT EXISTS flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_executions_flow ON flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_org ON flow_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_started ON flow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_flow_executions_conv ON flow_executions(conversation_id);

-- 3. Flow node events
CREATE TABLE IF NOT EXISTS flow_node_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES flow_executions(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_type text NOT NULL,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_node_events_exec ON flow_node_events(execution_id);
CREATE INDEX IF NOT EXISTS idx_flow_node_events_flow ON flow_node_events(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_node_events_node ON flow_node_events(flow_id, node_id);
CREATE INDEX IF NOT EXISTS idx_flow_node_events_entered ON flow_node_events(entered_at);

-- 4. RLS
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_node_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on flow_executions"
  ON flow_executions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on flow_node_events"
  ON flow_node_events FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Org members can read flow_executions"
  ON flow_executions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can read flow_node_events"
  ON flow_node_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
