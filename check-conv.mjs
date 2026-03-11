import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const vars = {};
for (const l of env.split('\n')) {
  const eq = l.indexOf('=');
  if (eq > 0 && l[0] !== '#') {
    vars[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
  }
}

const url = vars.NEXT_PUBLIC_SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY || vars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// List ALL flows
const res = await fetch(
  `${url}/rest/v1/flows?select=id,name,is_active,organization_id,nodes&order=updated_at.desc`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const flows = await res.json();
console.log(`Total flows: ${flows.length}`);
for (const flow of flows) {
  const triggers = (flow.nodes || []).filter(n => n.data?.type === 'trigger');
  const nodeTypes = (flow.nodes || []).map(n => n.data?.type).join(', ');
  console.log(`\nFlow: "${flow.name}" | id: ${flow.id} | active: ${flow.is_active} | org: ${flow.organization_id}`);
  console.log(`  Node types: ${nodeTypes}`);
  for (const t of triggers) {
    console.log(`  Trigger: type=${t.data.triggerType} keyword="${t.data.keyword || ''}" match=${t.data.keywordMatch || 'contains'}`);
  }
}

// Also check recent messages
const msgRes = await fetch(
  `${url}/rest/v1/messages?select=content,sender,type,created_at&order=created_at.desc&limit=5`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const msgs = await msgRes.json();
console.log('\n--- Recent messages ---');
for (const m of msgs) {
  console.log(`[${m.sender}] ${m.content?.substring(0, 80)} (${m.type})`);
}
