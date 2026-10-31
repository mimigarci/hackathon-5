-- Google login for everyone. Run once in Supabase > SQL Editor on a project
-- that already has supabase/schema.sql. Safe to re-run.
--
-- - Profiles keep the Google name, email and photo.
-- - Two Google accounts with the same email prefix no longer collide on the
--   unique username (the sign-up used to fail).
-- - Every new account gets demo data (balance, movements, registered
--   services, pending/scheduled payments) so Home isn't empty.

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;

create or replace function public.seed_demo_data(p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.movements where user_id = p_user) then
    return; -- already seeded
  end if;

  update public.wallets set balance = 2500, updated_at = now() where user_id = p_user;

  insert into public.movements (user_id, type, title, subtitle, amount, created_at) values
    (p_user, 'income',  'Depósito',        'Pago Móvil · Banco de Venezuela', 3000.00, now() - interval '3 days'),
    (p_user, 'expense', 'Pago Digitel',    'Recarga prepago',                  320.00, now() - interval '2 days'),
    (p_user, 'expense', 'Estacionamiento', 'C.C. Sambil',                      180.00, now() - interval '1 day');

  insert into public.user_services (user_id, service_id, account_ref) values
    (p_user, 'movistar', '04141234521'),
    (p_user, 'digitel',  '04129876543'),
    (p_user, 'cantv',    '02121234567')
  on conflict do nothing;

  insert into public.payments (user_id, service_id, amount, status, due_date) values
    (p_user, 'movistar', 380.00, 'pending',   current_date + 5),
    (p_user, 'cantv',    145.50, 'pending',   current_date + 9),
    (p_user, 'digitel',  450.00, 'scheduled', current_date + 15);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base_name  text;
  final_name text;
begin
  base_name := lower(regexp_replace(coalesce(
    new.raw_user_meta_data ->> 'username',
    nullif(split_part(new.email, '@', 1), ''),
    'usuario'
  ), '[^a-zA-Z0-9_.]', '', 'g'));
  if base_name = '' then base_name := 'usuario'; end if;

  final_name := base_name;
  if exists (select 1 from public.profiles where username = final_name) then
    final_name := base_name || '_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, username, full_name, email, avatar_url, verified)
  values (
    new.id,
    final_name,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.email is not null
  );
  insert into public.wallets (user_id) values (new.id);
  perform public.seed_demo_data(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this migration get demo data too.
select public.seed_demo_data(p.id)
from public.profiles p
where not exists (select 1 from public.movements m where m.user_id = p.id);

revoke all on function public.seed_demo_data(uuid) from public, anon, authenticated;
