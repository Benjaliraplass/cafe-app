-- Extensiones
create extension if not exists "pgcrypto";

-- =========================
-- PROFILES
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select to authenticated, anon using (true);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Trigger: crear profile al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at genérico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================
-- ROASTERS (tostadurías)
-- =========================
create table public.roasters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text default 'Chile',
  city text,
  website text,
  instagram text,
  logo_url text,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.roasters enable row level security;
create index roasters_name_idx on public.roasters using gin (to_tsvector('spanish', name));
create index roasters_created_by_idx on public.roasters (created_by);

create policy "roasters_select_all" on public.roasters
  for select to authenticated, anon using (true);
create policy "roasters_insert_auth" on public.roasters
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "roasters_update_creator" on public.roasters
  for update to authenticated using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);

create trigger roasters_set_updated_at before update on public.roasters
  for each row execute function public.set_updated_at();

-- =========================
-- COFFEES (catálogo de cafés)
-- =========================
create table public.coffees (
  id uuid primary key default gen_random_uuid(),
  roaster_id uuid references public.roasters(id) on delete set null,
  name text not null,
  origin_country text,
  region text,
  farm text,
  producer text,
  variety text,
  process text,
  altitude_masl int,
  roast_level text,
  roast_profile text check (roast_profile in ('espresso', 'filtro', 'omni') or roast_profile is null),
  tasting_notes text[] not null default '{}',
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coffees enable row level security;
create index coffees_roaster_id_idx on public.coffees (roaster_id);
create index coffees_created_by_idx on public.coffees (created_by);
create index coffees_origin_idx on public.coffees (origin_country);
create index coffees_search_idx on public.coffees using gin (
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(origin_country, '') || ' ' || coalesce(region, '') || ' ' || coalesce(farm, ''))
);

create policy "coffees_select_all" on public.coffees
  for select to authenticated, anon using (true);
create policy "coffees_insert_auth" on public.coffees
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "coffees_update_creator" on public.coffees
  for update to authenticated using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);

create trigger coffees_set_updated_at before update on public.coffees
  for each row execute function public.set_updated_at();

-- =========================
-- COFFEE_LOGS (diario personal: cada café que tomé)
-- =========================
create table public.coffee_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  coffee_id uuid references public.coffees(id) on delete set null,
  photo_path text,
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  notes text,
  brew_method text,
  roast_date date,
  bought_at text,
  price_clp int,
  raw_scan jsonb,
  is_public boolean not null default false,
  consumed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coffee_logs enable row level security;
create index coffee_logs_user_id_idx on public.coffee_logs (user_id, created_at desc);
create index coffee_logs_coffee_id_idx on public.coffee_logs (coffee_id);

create policy "coffee_logs_select_own_or_public" on public.coffee_logs
  for select to authenticated using ((select auth.uid()) = user_id or is_public = true);
create policy "coffee_logs_insert_own" on public.coffee_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "coffee_logs_update_own" on public.coffee_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "coffee_logs_delete_own" on public.coffee_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger coffee_logs_set_updated_at before update on public.coffee_logs
  for each row execute function public.set_updated_at();

-- =========================
-- CAFES (cafeterías y tostadurías con local)
-- =========================
create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null default 'cafe' check (kind in ('cafe', 'roastery', 'both')),
  roaster_id uuid references public.roasters(id) on delete set null,
  address text,
  comuna text,
  city text,
  region text,
  lat double precision,
  lng double precision,
  instagram text,
  website text,
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cafes enable row level security;
create index cafes_status_city_idx on public.cafes (status, city);
create index cafes_roaster_id_idx on public.cafes (roaster_id);
create index cafes_created_by_idx on public.cafes (created_by);

create policy "cafes_select_approved_or_own" on public.cafes
  for select to authenticated, anon using (status = 'approved' or (select auth.uid()) = created_by);
create policy "cafes_insert_auth" on public.cafes
  for insert to authenticated with check ((select auth.uid()) = created_by and status = 'pending');
create policy "cafes_update_creator_pending" on public.cafes
  for update to authenticated using ((select auth.uid()) = created_by and status = 'pending') with check ((select auth.uid()) = created_by);

create trigger cafes_set_updated_at before update on public.cafes
  for each row execute function public.set_updated_at();

-- =========================
-- RECIPES (recetas generadas por IA o guardadas)
-- =========================
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  coffee_id uuid references public.coffees(id) on delete set null,
  coffee_log_id uuid references public.coffee_logs(id) on delete set null,
  brew_method text not null,
  title text,
  params jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  rationale text,
  source text not null default 'ai' check (source in ('ai', 'user')),
  created_at timestamptz not null default now()
);
alter table public.recipes enable row level security;
create index recipes_user_id_idx on public.recipes (user_id, created_at desc);
create index recipes_coffee_id_idx on public.recipes (coffee_id);
create index recipes_coffee_log_id_idx on public.recipes (coffee_log_id);

create policy "recipes_select_own" on public.recipes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- =========================
-- STORAGE: bucket de fotos
-- =========================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coffee-photos', 'coffee-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "coffee_photos_select_public" on storage.objects
  for select to authenticated, anon using (bucket_id = 'coffee-photos');
create policy "coffee_photos_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'coffee-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "coffee_photos_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'coffee-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "coffee_photos_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'coffee-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
