-- "Sobre su origen" (Lote 16): textos cortos sobre el país, la región y la finca de un café.
-- Se comparten entre cafés por clave normalizada; los escribe la Edge Function origin-story
-- (service role) y se leen con el RPC get_origin_notes(coffee_id).

create table public.origin_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('country', 'region', 'farm')),
  key text not null unique,
  title text,
  body text,
  fun_fact text,
  sources jsonb not null default '[]'::jsonb,
  -- Finca: false = se buscó y no hay información verificable (se guarda para no repetir la búsqueda).
  found boolean not null default true,
  hidden boolean not null default false,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.origin_notes enable row level security;

-- Lectura directa solo para el admin (el resto lee por el RPC). Sin políticas de insert:
-- escribe solo la Edge Function con service role.
create policy "origin_notes_select_admin" on public.origin_notes
  for select to authenticated using ((select public.is_admin()));
create policy "origin_notes_update_admin" on public.origin_notes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "origin_notes_delete_admin" on public.origin_notes
  for delete to authenticated using ((select public.is_admin()));

-- Normaliza un texto para la clave: sin tildes, minúsculas, solo letras y números separados por un espacio.
create or replace function public.origin_norm(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    trim(regexp_replace(lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', ' ', 'g')),
    ''
  );
$$;

-- Claves de origen de un café: país, región (si hay) y finca/productor (si hay). Sin país no hay claves.
create or replace function public.origin_keys_for_coffee(p_coffee_id uuid)
returns table (kind text, key text)
language sql
stable
set search_path = ''
as $$
  with c as (
    select
      public.origin_norm(origin_country) as country,
      public.origin_norm(region) as region,
      public.origin_norm(farm) as farm,
      public.origin_norm(producer) as producer
    from public.coffees
    where id = p_coffee_id
  )
  select 'country', 'country:' || country from c where country is not null
  union all
  select 'region', 'region:' || country || '|' || region from c where country is not null and region is not null
  union all
  select 'farm', 'farm:' || country || '|' || coalesce(farm, '') || '|' || coalesce(producer, '')
    from c where country is not null and (farm is not null or producer is not null);
$$;

-- Textos de origen de un café. Una fila por clave esperada: ready = ya se generó (o se ocultó).
-- El contenido de las ocultas solo lo ve el admin. Funciona sin sesión (ficha pública).
create or replace function public.get_origin_notes(p_coffee_id uuid)
returns table (
  kind text,
  key text,
  ready boolean,
  id uuid,
  title text,
  body text,
  fun_fact text,
  sources jsonb,
  found boolean,
  hidden boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with k as (select * from public.origin_keys_for_coffee(p_coffee_id)),
  vis as (select public.is_admin() as admin)
  select
    k.kind,
    k.key,
    n.id is not null,
    n.id,
    case when not n.hidden or vis.admin then n.title end,
    case when not n.hidden or vis.admin then n.body end,
    case when not n.hidden or vis.admin then n.fun_fact end,
    case when not n.hidden or vis.admin then n.sources end,
    n.found,
    n.hidden
  from k
  cross join vis
  left join public.origin_notes n on n.key = k.key;
$$;

revoke execute on function public.get_origin_notes(uuid) from public;
grant execute on function public.get_origin_notes(uuid) to anon, authenticated;
