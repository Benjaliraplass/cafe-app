-- Perfil de gusto declarado por el usuario. Tabla aparte para que sea privado
-- (profiles es de lectura pública: nombre y avatar aparecen en fichas de cafés).
create table if not exists public.taste_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.taste_profiles enable row level security;

create policy "taste_profiles_select_own" on public.taste_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "taste_profiles_insert_own" on public.taste_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "taste_profiles_update_own" on public.taste_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "taste_profiles_delete_own" on public.taste_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger taste_profiles_set_updated_at before update on public.taste_profiles
  for each row execute function public.set_updated_at();
