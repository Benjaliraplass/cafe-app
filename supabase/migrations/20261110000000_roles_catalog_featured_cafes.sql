-- Lote 3 / bloque 0: roles, publicación de cafés en el catálogo, recetas destacadas y moderación de cafeterías.

-- =========================
-- ROLES
-- =========================
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- ¿El usuario actual es admin? Se usa en políticas como (select public.is_admin()).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Nadie cambia su propio rol salvo un admin. Las migraciones y el service role (sin auth.uid()) no se ven afectados.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'No puedes cambiar el rol' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Admin inicial: Benjamín (ambos correos, si existen)
update public.profiles p set role = 'admin'
from auth.users u
where u.id = p.id and lower(u.email) in ('benjamin@tostadoclub.com', 'benjalira11@gmail.com');

-- =========================
-- COFFEES: publicación en el catálogo
-- =========================
alter table public.coffees
  add column if not exists photo_path text,
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz;

create index if not exists coffees_published_idx on public.coffees (published_at desc) where is_published;

-- El admin puede editar cualquier café (publicar, corregir datos, foto)
drop policy if exists "coffees_update_admin" on public.coffees;
create policy "coffees_update_admin" on public.coffees
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Registros públicos visibles sin sesión (ficha pública del café)
drop policy if exists "coffee_logs_select_public_anon" on public.coffee_logs;
create policy "coffee_logs_select_public_anon" on public.coffee_logs
  for select to anon using (is_public = true);

create index if not exists coffee_logs_public_coffee_idx on public.coffee_logs (coffee_id) where is_public;

-- Promedio y cantidad de puntajes públicos por café (respeta RLS del que consulta)
create or replace view public.coffee_public_stats
with (security_invoker = true) as
  select coffee_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as ratings_count
  from public.coffee_logs
  where is_public and rating > 0
  group by coffee_id;
grant select on public.coffee_public_stats to anon, authenticated;

-- =========================
-- FEATURED_RECIPES (recetas destacadas, curadas por admin)
-- =========================
create table if not exists public.featured_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  author_role text not null default 'otro' check (author_role in ('tostador', 'campeon', 'barista', 'otro')),
  country text,
  event text,
  method_family text not null check (method_family in ('conico', 'flat', 'inmersion', 'espresso')),
  dripper text not null,
  params jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  story text,
  source_url text,
  photo_path text,
  is_published boolean not null default false,
  sort_order int not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.featured_recipes enable row level security;
create index if not exists featured_recipes_created_by_idx on public.featured_recipes (created_by);
create index if not exists featured_recipes_published_idx on public.featured_recipes (sort_order) where is_published;

drop policy if exists "featured_recipes_select_published_or_admin" on public.featured_recipes;
create policy "featured_recipes_select_published_or_admin" on public.featured_recipes
  for select to authenticated, anon using (is_published = true or (select public.is_admin()));
drop policy if exists "featured_recipes_insert_admin" on public.featured_recipes;
create policy "featured_recipes_insert_admin" on public.featured_recipes
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "featured_recipes_update_admin" on public.featured_recipes;
create policy "featured_recipes_update_admin" on public.featured_recipes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "featured_recipes_delete_admin" on public.featured_recipes;
create policy "featured_recipes_delete_admin" on public.featured_recipes
  for delete to authenticated using ((select public.is_admin()));

drop trigger if exists featured_recipes_set_updated_at on public.featured_recipes;
create trigger featured_recipes_set_updated_at before update on public.featured_recipes
  for each row execute function public.set_updated_at();

-- =========================
-- CAFES: moderación
-- =========================
alter table public.cafes
  add column if not exists photo_path text,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

create index if not exists cafes_approved_by_idx on public.cafes (approved_by);
create index if not exists cafes_approved_geo_idx on public.cafes (lat, lng) where status = 'approved';

-- El admin ve y edita todo (cola de moderación)
drop policy if exists "cafes_select_admin" on public.cafes;
create policy "cafes_select_admin" on public.cafes
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "cafes_update_admin" on public.cafes;
create policy "cafes_update_admin" on public.cafes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "cafes_delete_admin" on public.cafes;
create policy "cafes_delete_admin" on public.cafes
  for delete to authenticated using ((select public.is_admin()));
