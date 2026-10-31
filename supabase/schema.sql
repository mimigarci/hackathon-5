-- PagoDirecto hackathon schema. Paste into Supabase > SQL Editor and run,
-- then run every file in supabase/migrations/ in order.
-- Matches the models in app/lib/data/models.dart and the queries in
-- app/lib/data/supabase_repository.dart.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text unique not null,
  level           text not null default 'Turista',
  avatar_url      text,
  verified        boolean not null default false,
  streak_progress numeric not null default 0 check (streak_progress between 0 and 1),
  created_at      timestamptz not null default now()
);

create table public.wallets (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  balance    numeric(14, 2) not null default 0,
  currency   text not null default 'VES',
  updated_at timestamptz not null default now()
);

create type public.movement_type as enum ('income', 'expense');

create table public.movements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.movement_type not null,
  title      text not null,
  subtitle   text,
  amount     numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index movements_user_created_idx on public.movements (user_id, created_at desc);

-- Catalog of payable providers (Digitel, Movilnet, Movistar, CANTV...).
create table public.services (
  id          text primary key,
  name        text not null,
  brand_color text not null default '#1B1B1F',
  category    text not null default 'telefonia',
  logo_url    text
);

-- Services a user registered ("Registra tu servicio").
create table public.user_services (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  service_id  text not null references public.services (id),
  account_ref text,
  created_at  timestamptz not null default now(),
  primary key (user_id, service_id)
);

create type public.payment_status as enum ('pending', 'scheduled', 'paid');

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  service_id text not null references public.services (id),
  amount     numeric(14, 2) not null check (amount >= 0),
  status     public.payment_status not null default 'pending',
  due_date   date,
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);
create index payments_user_status_idx on public.payments (user_id, status);

-- Club PagoDirecto challenges and who completed them.
create table public.club_tasks (
  id          text primary key,
  title       text not null,
  description text not null,
  points      int not null,
  icon        text not null default 'star',
  sort_order  int not null default 0
);

create table public.user_club_tasks (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  task_id      text not null references public.club_tasks (id),
  completed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

-- ---------------------------------------------------------------------------
-- Row level security: every user only sees their own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.wallets         enable row level security;
alter table public.movements       enable row level security;
alter table public.services        enable row level security;
alter table public.user_services   enable row level security;
alter table public.payments        enable row level security;
alter table public.club_tasks      enable row level security;
alter table public.user_club_tasks enable row level security;

create policy "own profile"  on public.profiles  for select using (auth.uid() = id);
create policy "edit profile" on public.profiles  for update using (auth.uid() = id);
create policy "own wallet"   on public.wallets   for select using (auth.uid() = user_id);
create policy "own movements" on public.movements for select using (auth.uid() = user_id);

create policy "catalog readable" on public.services   for select to authenticated using (true);
create policy "club readable"    on public.club_tasks for select to authenticated using (true);

create policy "own services" on public.user_services for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own payments" on public.payments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own club progress" on public.user_club_tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Balance and movements are written server-side only (service role, edge
-- functions, or a backend), never directly by the app.

-- ---------------------------------------------------------------------------
-- New users get a profile + empty wallet automatically.
-- migrations/001_google_login.sql replaces this trigger for Google sign-in
-- (Google name/photo, no username collisions, demo data): run it right after
-- this file.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    -- Anonymous users (MVP, no login) have no email: fall back to an id-based name.
    coalesce(
      new.raw_user_meta_data ->> 'username',
      nullif(split_part(new.email, '@', 1), ''),
      'usuario_' || left(new.id::text, 8)
    )
  );
  insert into public.wallets (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.services (id, name, brand_color) values
  ('digitel',  'Digitel',  '#C8102E'),
  ('movilnet', 'Movilnet', '#E5332A'),
  ('movistar', 'Movistar', '#0B9DDC'),
  ('cantv',    'CANTV',    '#0055A5');

insert into public.club_tasks (id, title, description, points, icon, sort_order) values
  ('passkey', 'Llave de acceso', 'Activa, protege tu cuenta y gana puntos del Club.', 250, 'key', 1),
  ('vehicle', 'Registra tu vehículo', 'Agrega tu placa y paga estacionamientos más rápido.', 150, 'car', 2);
