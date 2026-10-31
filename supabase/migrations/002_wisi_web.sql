-- Webapp de botflow.lat (Worker + Durable Objects). Pegar y ejecutar una vez en
-- Supabase > SQL Editor. Se puede repetir sin riesgo.
--
-- El Worker sigue siendo la fuente del saldo (el Durable Object lo mueve de forma
-- atómica) y replica cada operación aquí para consultarla desde Supabase. Es una
-- copia de datos de demo: nada de lo que entra aquí mueve dinero ni cambia el saldo.
-- Las tablas quedan cerradas por RLS: con la clave publicable no se pueden leer, y
-- solo se escribe a través de wisi_sync.

create table if not exists public.wisi_accounts (
  principal         text primary key,
  balance_minor     bigint not null,
  credit_used_minor bigint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.wisi_movements (
  operation_ref text primary key,
  principal     text not null references public.wisi_accounts (principal) on delete cascade,
  kind          text not null,
  title         text not null,
  amount_minor  bigint not null,
  details       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists wisi_movements_principal_idx on public.wisi_movements (principal, created_at desc);

alter table public.wisi_accounts  enable row level security;
alter table public.wisi_movements enable row level security;

create or replace function public.wisi_sync(p_principal text, p_balance bigint, p_credit_used bigint, p_op jsonb default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if length(p_principal) > 64 then
    raise exception 'principal no válido';
  end if;
  insert into public.wisi_accounts (principal, balance_minor, credit_used_minor)
  values (p_principal, p_balance, p_credit_used)
  on conflict (principal) do update
    set balance_minor = excluded.balance_minor,
        credit_used_minor = excluded.credit_used_minor,
        updated_at = now();
  if p_op is not null then
    insert into public.wisi_movements (operation_ref, principal, kind, title, amount_minor, details)
    values (p_op ->> 'operation_ref', p_principal, p_op ->> 'kind', p_op ->> 'title',
            (p_op ->> 'amount_minor')::bigint, coalesce(p_op -> 'details', '{}'))
    on conflict (operation_ref) do nothing;
  end if;
end;
$$;

-- Para que /health sepa si esta migración está aplicada.
create or replace function public.wisi_ping()
returns text language sql stable as $$ select 'ok'::text $$;

revoke all on function public.wisi_sync(text, bigint, bigint, jsonb) from public;
grant execute on function public.wisi_sync(text, bigint, bigint, jsonb) to anon, authenticated;
grant execute on function public.wisi_ping() to anon, authenticated;
