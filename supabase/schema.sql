-- School Facility & Repair System — schema, triggers and RLS
-- Run in the Supabase SQL editor (or `supabase db push`).

-- 1) Enums ------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'staff', 'user');
create type public.ticket_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type public.urgency_level as enum ('low', 'medium', 'high', 'emergency');
create type public.repair_category as enum (
  'electrical', 'plumbing', 'building_structure',
  'furniture_equipment', 'environment_grounds', 'other'
);

-- 2) Tables -----------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  department text,
  role public.user_role not null default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.repair_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,  -- REQ-YYYYMM-XXXX (auto-filled by trigger)
  reporter_id uuid not null references public.profiles (id),
  title text not null,
  description text not null,
  category public.repair_category not null default 'other',
  location_building text not null,
  location_room text,
  urgency public.urgency_level not null default 'medium',
  status public.ticket_status not null default 'pending',
  image_urls text[] default '{}',
  technician_notes text,
  estimated_cost numeric(10, 2) default 0.00,
  document_ref_no text,                -- official memo reference number
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index repair_tickets_reporter_idx on public.repair_tickets (reporter_id);
create index repair_tickets_status_idx on public.repair_tickets (status);
create index repair_tickets_created_idx on public.repair_tickets (created_at desc);

-- 3) Helpers & triggers ----------------------------------------------
create sequence public.ticket_number_seq;

create or replace function public.set_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'REQ-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((nextval('public.ticket_number_seq') % 10000)::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger repair_tickets_set_number
  before insert on public.repair_tickets
  for each row execute function public.set_ticket_number();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger repair_tickets_touch before update on public.repair_tickets
  for each row execute function public.touch_updated_at();

-- Create a profile automatically on first sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers (security definer avoids recursive RLS on profiles).
create or replace function public.current_role_is(variadic roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (roles)
  );
$$;

-- 4) Row Level Security ----------------------------------------------
alter table public.profiles enable row level security;
alter table public.repair_tickets enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: super_admin read all" on public.profiles
  for select to authenticated
  using (public.current_role_is('super_admin'));

create policy "profiles: super_admin update all" on public.profiles
  for update to authenticated
  using (public.current_role_is('super_admin'))
  with check (public.current_role_is('super_admin'));

-- Users may edit their own profile, but never escalate their own role.
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

-- repair_tickets
create policy "tickets: user reads own" on public.repair_tickets
  for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy "tickets: staff read all" on public.repair_tickets
  for select to authenticated
  using (public.current_role_is('staff', 'super_admin'));

create policy "tickets: user creates own" on public.repair_tickets
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "tickets: staff update all" on public.repair_tickets
  for update to authenticated
  using (public.current_role_is('staff', 'super_admin'))
  with check (public.current_role_is('staff', 'super_admin'));
