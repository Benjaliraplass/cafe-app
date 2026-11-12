-- Lote 10: beta por invitación.
-- Registro cerrado en Supabase (Allow new users to sign up = off). Las cuentas las crea la
-- Edge Function `join` (service role) si el correo está en la lista blanca (clientes de Tostado
-- Club) o llega con el código de un usuario con cupo. El resto cae en la lista de espera.
-- Invitaciones: 3 al guardar el primer café, +2 al guardar la primera receta (total 5).

-- =========================
-- PROFILES: código, cupo, quién invitó, fundador
-- =========================
alter table public.profiles
  add column if not exists invite_code   text,
  add column if not exists invites_total int not null default 0,
  add column if not exists invites_seen  int not null default 0,
  add column if not exists invited_by    uuid references public.profiles (id) on delete set null,
  add column if not exists is_founder    boolean not null default false;

-- Código de 10 caracteres derivado del id (sin guiones). Es el ?ref= de los enlaces compartidos.
update public.profiles set invite_code = left(replace(id::text, '-', ''), 10) where invite_code is null;
alter table public.profiles alter column invite_code set not null;
create unique index if not exists profiles_invite_code_idx on public.profiles (invite_code);
create index if not exists profiles_invited_by_idx on public.profiles (invited_by);

-- Cuentas existentes al cerrar el registro: fundadores.
update public.profiles set is_founder = true;

-- handle_new_user: fija invite_code y, si la cuenta la creó `join`, quién invitó (viene en user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inviter uuid;
begin
  begin
    v_inviter := (new.raw_user_meta_data->>'invited_by')::uuid;
  exception when others then
    v_inviter := null;
  end;
  insert into public.profiles (id, display_name, avatar_url, invite_code, invited_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    left(replace(new.id::text, '-', ''), 10),
    v_inviter
  );
  return new;
end;
$$;

-- Nadie edita su cupo, su código ni quién lo invitó (solo service role / migraciones).
-- refresh_invites() marca dripo.internal en la transacción para poder actualizar el cupo.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() and coalesce(current_setting('dripo.internal', true), '') <> 'on' then
    if new.role is distinct from old.role then
      raise exception 'No puedes cambiar el rol' using errcode = '42501';
    end if;
    if new.invite_code is distinct from old.invite_code
       or new.invites_total is distinct from old.invites_total
       or new.invited_by is distinct from old.invited_by
       or new.is_founder is distinct from old.is_founder then
      raise exception 'No puedes cambiar las invitaciones' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- =========================
-- Desbloqueo: 3 con el primer café, +2 con la primera receta. Idempotente.
-- =========================
create or replace function public.refresh_invites(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int := 0;
begin
  if exists (select 1 from public.coffee_logs l where l.user_id = p_user) then v_total := v_total + 3; end if;
  if exists (select 1 from public.recipes r where r.user_id = p_user) then v_total := v_total + 2; end if;
  perform set_config('dripo.internal', 'on', true);
  update public.profiles set invites_total = v_total where id = p_user and invites_total <> v_total;
  perform set_config('dripo.internal', '', true);
end;
$$;
revoke execute on function public.refresh_invites(uuid) from public, anon, authenticated;

create or replace function public.refresh_invites_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_invites(new.user_id);
  return new;
end;
$$;
revoke execute on function public.refresh_invites_trigger() from public, anon, authenticated;

drop trigger if exists coffee_logs_refresh_invites on public.coffee_logs;
create trigger coffee_logs_refresh_invites after insert on public.coffee_logs
  for each row execute function public.refresh_invites_trigger();
drop trigger if exists recipes_refresh_invites on public.recipes;
create trigger recipes_refresh_invites after insert on public.recipes
  for each row execute function public.refresh_invites_trigger();

-- Backfill de las cuentas existentes.
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_invites(r.id);
  end loop;
end $$;

-- =========================
-- Lista blanca (clientes de Tostado Club) y lista de espera. Solo service role.
-- =========================
create table if not exists public.allowlist (
  email      text primary key,
  source     text not null default 'shopify',
  created_at timestamptz not null default now()
);
alter table public.allowlist enable row level security;
comment on table public.allowlist is 'Correos con cupo directo (clientes de Tostado Club). Sin políticas: solo service role.';

create table if not exists public.waitlist (
  email      text primary key,
  ref_code   text,
  created_at timestamptz not null default now(),
  invited_at timestamptz
);
alter table public.waitlist enable row level security;
create index if not exists waitlist_created_idx on public.waitlist (created_at);
comment on table public.waitlist is 'Correos sin invitación. Sin políticas: solo service role.';

-- =========================
-- Lecturas desde la app
-- =========================
-- Mis invitaciones: código, total, usadas, vistas.
create or replace function public.my_invites()
returns table (code text, total int, used int, seen int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.invite_code, p.invites_total,
         (select count(*)::int from public.profiles c where c.invited_by = p.id),
         p.invites_seen
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- Marca como vistas las invitaciones desbloqueadas (la hoja de "Desbloqueaste N" no se repite).
create or replace function public.mark_invites_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set invites_seen = invites_total where id = auth.uid();
$$;
revoke execute on function public.mark_invites_seen() from public, anon;
grant execute on function public.mark_invites_seen() to authenticated;

-- Franja "X te invita": nombre de pila del dueño del código y si le queda cupo. Pública.
create or replace function public.invite_info(p_code text)
returns table (first_name text, has_quota boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(coalesce(p.display_name, ''), ' ', 1),
         p.invites_total > (select count(*) from public.profiles c where c.invited_by = p.id)
  from public.profiles p
  where p.invite_code = lower(left(p_code, 10));
$$;
revoke execute on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;

-- =========================
-- Admin: métricas del lote
-- =========================
create or replace function public.admin_invite_stats()
returns table (founders int, invited int, unlocked int, used int, allowlist int, waitlist int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.profiles where is_founder),
    (select count(*)::int from public.profiles where invited_by is not null),
    (select coalesce(sum(invites_total), 0)::int from public.profiles),
    (select count(*)::int from public.profiles where invited_by is not null),
    (select count(*)::int from public.allowlist),
    (select count(*)::int from public.waitlist where invited_at is null)
  where public.is_admin();
$$;
revoke execute on function public.admin_invite_stats() from public, anon;
grant execute on function public.admin_invite_stats() to authenticated;
