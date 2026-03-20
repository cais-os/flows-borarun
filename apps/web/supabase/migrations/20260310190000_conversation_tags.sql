create table if not exists public.conversation_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversation_tags_name_not_blank
    check (char_length(btrim(name)) between 1 and 40)
);

create unique index if not exists conversation_tags_org_lower_name_idx
  on public.conversation_tags (organization_id, lower(name));

create index if not exists conversation_tags_organization_id_idx
  on public.conversation_tags (organization_id);

drop trigger if exists trg_conversation_tags_set_updated_at on public.conversation_tags;
create trigger trg_conversation_tags_set_updated_at
before update on public.conversation_tags
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.conversation_tag_assignments (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tag_id uuid not null references public.conversation_tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, tag_id)
);

create index if not exists conversation_tag_assignments_conversation_id_idx
  on public.conversation_tag_assignments (conversation_id);

create index if not exists conversation_tag_assignments_tag_id_idx
  on public.conversation_tag_assignments (tag_id);

alter table public.conversation_tags enable row level security;
alter table public.conversation_tag_assignments enable row level security;

drop policy if exists conversation_tags_member_access on public.conversation_tags;
create policy conversation_tags_member_access
on public.conversation_tags
for all
using (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = conversation_tags.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.organization_members as members
     where members.organization_id = conversation_tags.organization_id
       and members.user_id = auth.uid()
  )
);

drop policy if exists conversation_tag_assignments_member_access on public.conversation_tag_assignments;
create policy conversation_tag_assignments_member_access
on public.conversation_tag_assignments
for all
using (
  exists (
    select 1
      from public.conversations as conversations
      join public.conversation_tags as tags
        on tags.id = conversation_tag_assignments.tag_id
      join public.organization_members as members
        on members.organization_id = conversations.organization_id
     where conversations.id = conversation_tag_assignments.conversation_id
       and conversations.organization_id = tags.organization_id
       and members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.conversations as conversations
      join public.conversation_tags as tags
        on tags.id = conversation_tag_assignments.tag_id
      join public.organization_members as members
        on members.organization_id = conversations.organization_id
     where conversations.id = conversation_tag_assignments.conversation_id
       and conversations.organization_id = tags.organization_id
       and members.user_id = auth.uid()
  )
);
