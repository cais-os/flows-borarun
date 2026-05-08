create extension if not exists pgcrypto;

do $$
begin
  create type public.runner_generation_status as enum ('idle', 'generating', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.runner_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  phone text not null,
  normalized_phone text not null unique,
  public_access_key text not null default encode(gen_random_bytes(16), 'hex'),
  generation_status public.runner_generation_status not null default 'idle',
  generated_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists runner_profiles_conversation_id_idx
  on public.runner_profiles(conversation_id);

create index if not exists runner_profiles_organization_id_idx
  on public.runner_profiles(organization_id);

drop trigger if exists trg_runner_profiles_set_updated_at on public.runner_profiles;
create trigger trg_runner_profiles_set_updated_at
before update on public.runner_profiles
for each row
execute function public.set_updated_at_timestamp();

alter table public.runner_profiles enable row level security;

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  runner_profile_id uuid references public.runner_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  goal_type text not null,
  goal_distance numeric,
  race_date date,
  start_date date,
  total_weeks integer not null,
  total_distance numeric not null default 0,
  completed_distance numeric not null default 0,
  completed_weeks integer not null default 0,
  raw_plan jsonb not null default '{}'::jsonb,
  coaching_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint training_plans_owner_check check (
    runner_profile_id is not null or user_id is not null
  )
);

create unique index if not exists training_plans_runner_profile_id_unique_idx
  on public.training_plans(runner_profile_id)
  where runner_profile_id is not null;

create index if not exists training_plans_conversation_id_idx
  on public.training_plans(conversation_id);

drop trigger if exists trg_training_plans_set_updated_at on public.training_plans;
create trigger trg_training_plans_set_updated_at
before update on public.training_plans
for each row
execute function public.set_updated_at_timestamp();

alter table public.training_plans enable row level security;

create table if not exists public.weekly_trainings (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.training_plans(id) on delete cascade,
  runner_profile_id uuid references public.runner_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  week_number integer not null,
  day_of_week text not null,
  date date not null,
  type text not null,
  name text not null,
  title text not null,
  description text,
  distance numeric not null default 0,
  pace text not null default '',
  duration numeric not null default 0,
  elapsed_time numeric not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  actual_distance numeric,
  actual_elapsed_time numeric,
  actual_time text,
  actual_pace text,
  difficulty_level integer check (difficulty_level between 1 and 5),
  feedbacks text,
  source text not null default 'plan',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists weekly_trainings_plan_week_idx
  on public.weekly_trainings(training_plan_id, week_number);

create index if not exists weekly_trainings_runner_profile_date_idx
  on public.weekly_trainings(runner_profile_id, date);

drop trigger if exists trg_weekly_trainings_set_updated_at on public.weekly_trainings;
create trigger trg_weekly_trainings_set_updated_at
before update on public.weekly_trainings
for each row
execute function public.set_updated_at_timestamp();

alter table public.weekly_trainings enable row level security;
