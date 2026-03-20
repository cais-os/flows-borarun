create extension if not exists pgcrypto;

create table if not exists public.strava_connections (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  contact_phone text not null,
  athlete_id bigint not null,
  athlete_username text,
  athlete_firstname text,
  athlete_lastname text,
  profile_medium text,
  profile text,
  scopes text[] not null default '{}',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  last_synced_at timestamptz,
  sync_status text not null default 'pending',
  last_sync_error text,
  raw_athlete jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists strava_connections_contact_phone_idx
  on public.strava_connections(contact_phone);

create index if not exists strava_connections_athlete_id_idx
  on public.strava_connections(athlete_id);

create table if not exists public.strava_activities (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  connection_id uuid not null references public.strava_connections(id) on delete cascade,
  strava_activity_id bigint not null,
  name text not null,
  type text not null,
  sport_type text,
  start_date timestamptz not null,
  timezone text,
  distance_meters double precision not null default 0,
  moving_time_seconds integer not null default 0,
  elapsed_time_seconds integer not null default 0,
  total_elevation_gain double precision not null default 0,
  average_speed double precision,
  max_speed double precision,
  average_heartrate double precision,
  max_heartrate double precision,
  average_cadence double precision,
  kilojoules double precision,
  trainer boolean not null default false,
  commute boolean not null default false,
  manual boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint strava_activities_conversation_activity_unique
    unique (conversation_id, strava_activity_id)
);

create index if not exists strava_activities_conversation_start_date_idx
  on public.strava_activities(conversation_id, start_date desc);

create index if not exists strava_activities_sport_type_idx
  on public.strava_activities(sport_type);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_strava_connections_set_updated_at on public.strava_connections;
create trigger trg_strava_connections_set_updated_at
before update on public.strava_connections
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists trg_strava_activities_set_updated_at on public.strava_activities;
create trigger trg_strava_activities_set_updated_at
before update on public.strava_activities
for each row
execute function public.set_updated_at_timestamp();
