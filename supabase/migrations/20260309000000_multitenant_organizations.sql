create extension if not exists pgcrypto;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_organizations_set_updated_at on public.organizations;
create trigger trg_organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);

create index if not exists organization_members_organization_id_idx
  on public.organization_members(organization_id);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  subscription_plan text not null default 'free',
  business_name text,
  business_phone text,
  meta_phone_number_id text,
  meta_waba_id text,
  meta_app_id text,
  meta_app_secret text,
  meta_system_token text,
  meta_webhook_verify_token text,
  meta_graph_api_version text not null default 'v23.0',
  strava_client_id text,
  strava_client_secret text,
  strava_scopes text[] not null default '{read,activity:read_all}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_organization_settings_set_updated_at on public.organization_settings;
create trigger trg_organization_settings_set_updated_at
before update on public.organization_settings
for each row
execute function public.set_updated_at_timestamp();

do $$
declare
  legacy_organization_id uuid;
begin
  insert into public.organizations (name, slug)
  values ('Legacy Workspace', 'legacy-workspace')
  on conflict (slug) do update set slug = excluded.slug
  returning id into legacy_organization_id;

  if legacy_organization_id is null then
    select id
      into legacy_organization_id
      from public.organizations
     where slug = 'legacy-workspace'
     limit 1;
  end if;

  insert into public.organization_settings (organization_id, business_name)
  values (legacy_organization_id, 'Legacy Workspace')
  on conflict (organization_id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  select legacy_organization_id, users.id, 'owner'
    from auth.users as users
   where not exists (
     select 1
       from public.organization_members as members
      where members.user_id = users.id
   );
end
$$;

alter table public.flows
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.messages
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.campaigns
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.shortcuts
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.ai_guidelines
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.pdf_templates
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.strava_connections
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.strava_activities
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

do $$
declare
  legacy_organization_id uuid;
begin
  select id
    into legacy_organization_id
    from public.organizations
   where slug = 'legacy-workspace'
   limit 1;

  update public.flows
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.conversations
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.messages as messages
     set organization_id = conversations.organization_id
    from public.conversations as conversations
   where messages.conversation_id = conversations.id
     and messages.organization_id is null;

  update public.messages
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.campaigns
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.shortcuts
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.ai_guidelines
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.pdf_templates
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.strava_connections as connections
     set organization_id = conversations.organization_id
    from public.conversations as conversations
   where connections.conversation_id = conversations.id
     and connections.organization_id is null;

  update public.strava_connections
     set organization_id = legacy_organization_id
   where organization_id is null;

  update public.strava_activities as activities
     set organization_id = conversations.organization_id
    from public.conversations as conversations
   where activities.conversation_id = conversations.id
     and activities.organization_id is null;

  update public.strava_activities
     set organization_id = legacy_organization_id
   where organization_id is null;
end
$$;

alter table public.flows alter column organization_id set not null;
alter table public.conversations alter column organization_id set not null;
alter table public.messages alter column organization_id set not null;
alter table public.campaigns alter column organization_id set not null;
alter table public.shortcuts alter column organization_id set not null;
alter table public.ai_guidelines alter column organization_id set not null;
alter table public.pdf_templates alter column organization_id set not null;
alter table public.strava_connections alter column organization_id set not null;
alter table public.strava_activities alter column organization_id set not null;

create index if not exists flows_organization_id_idx
  on public.flows(organization_id);

create index if not exists conversations_organization_id_idx
  on public.conversations(organization_id);

create index if not exists messages_organization_id_idx
  on public.messages(organization_id);

create index if not exists campaigns_organization_id_idx
  on public.campaigns(organization_id);

create index if not exists shortcuts_organization_id_idx
  on public.shortcuts(organization_id);

create index if not exists ai_guidelines_organization_id_idx
  on public.ai_guidelines(organization_id);

create index if not exists pdf_templates_organization_id_idx
  on public.pdf_templates(organization_id);

create index if not exists strava_connections_organization_id_idx
  on public.strava_connections(organization_id);

create index if not exists strava_activities_organization_id_idx
  on public.strava_activities(organization_id);

create unique index if not exists ai_guidelines_organization_key_idx
  on public.ai_guidelines(organization_id, key);

create unique index if not exists shortcuts_organization_trigger_idx
  on public.shortcuts(organization_id, trigger);

create or replace function public.assign_conversation_organization_id()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and new.conversation_id is not null then
    select organization_id
      into new.organization_id
      from public.conversations
     where id = new.conversation_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_assign_organization_id on public.messages;
create trigger trg_messages_assign_organization_id
before insert or update on public.messages
for each row
execute function public.assign_conversation_organization_id();

drop trigger if exists trg_strava_connections_assign_organization_id on public.strava_connections;
create trigger trg_strava_connections_assign_organization_id
before insert or update on public.strava_connections
for each row
execute function public.assign_conversation_organization_id();

drop trigger if exists trg_strava_activities_assign_organization_id on public.strava_activities;
create trigger trg_strava_activities_assign_organization_id
before insert or update on public.strava_activities
for each row
execute function public.assign_conversation_organization_id();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
  base_name text;
begin
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'Assessoria');

  insert into public.organizations (name)
  values (initcap(replace(base_name, '.', ' ')))
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, new.id, 'owner');

  insert into public.organization_settings (organization_id, email, business_name)
  values (new_organization_id, new.email, initcap(replace(base_name, '.', ' ')));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_settings enable row level security;
alter table public.flows enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.campaigns enable row level security;
alter table public.shortcuts enable row level security;
alter table public.ai_guidelines enable row level security;
alter table public.pdf_templates enable row level security;
alter table public.strava_connections enable row level security;
alter table public.strava_activities enable row level security;

drop policy if exists organizations_member_access on public.organizations;
create policy organizations_member_access
on public.organizations
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = organizations.id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = organizations.id
       and members.user_id = auth.uid()
  )
);

drop policy if exists organization_members_member_access on public.organization_members;
create policy organization_members_member_access
on public.organization_members
for select
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = organization_members.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists organization_settings_member_access on public.organization_settings;
create policy organization_settings_member_access
on public.organization_settings
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = organization_settings.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = organization_settings.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists flows_member_access on public.flows;
create policy flows_member_access
on public.flows
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = flows.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = flows.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists conversations_member_access on public.conversations;
create policy conversations_member_access
on public.conversations
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = conversations.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = conversations.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists messages_member_access on public.messages;
create policy messages_member_access
on public.messages
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = messages.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = messages.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists campaigns_member_access on public.campaigns;
create policy campaigns_member_access
on public.campaigns
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = campaigns.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = campaigns.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists shortcuts_member_access on public.shortcuts;
create policy shortcuts_member_access
on public.shortcuts
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = shortcuts.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = shortcuts.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists ai_guidelines_member_access on public.ai_guidelines;
create policy ai_guidelines_member_access
on public.ai_guidelines
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = ai_guidelines.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = ai_guidelines.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists pdf_templates_member_access on public.pdf_templates;
create policy pdf_templates_member_access
on public.pdf_templates
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = pdf_templates.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = pdf_templates.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists strava_connections_member_access on public.strava_connections;
create policy strava_connections_member_access
on public.strava_connections
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = strava_connections.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = strava_connections.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists strava_activities_member_access on public.strava_activities;
create policy strava_activities_member_access
on public.strava_activities
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = strava_activities.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = strava_activities.organization_id
       and members.user_id = auth.uid()
  )
);
