-- Día del lanzamiento (2026-11-14): registro abierto temporal. El WhatsApp a ~2.800 clientes de Tostado Club
-- enlazó a dripocoffee.com y muchos usan un correo distinto al de la lista blanca. Mientras join_open()
-- devuelva true, /unete invita a cualquier correo nuevo (como si estuviera en la lista blanca) y no hay
-- lista de espera. Para volver a la beta por invitación: redefinir join_open() para que devuelva false.

create or replace function public.join_open()
returns boolean
language sql
immutable
set search_path = ''
as $$ select true $$;
revoke execute on function public.join_open() from public, anon, authenticated;

create or replace function public.join_decision(p_email text, p_ref text default null)
returns table (status text, inviter uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(trim(p_email));
  v_ref     text := nullif(lower(left(trim(coalesce(p_ref, '')), 10)), '');
  v_inviter uuid;
  v_quota   int;
  v_user    record;
begin
  select u.email_confirmed_at, u.last_sign_in_at into v_user
  from auth.users u where lower(u.email) = v_email
  limit 1;
  if found then
    if v_user.email_confirmed_at is null and v_user.last_sign_in_at is null then
      return query select 'pending'::text, null::uuid; return;
    end if;
    return query select 'exists'::text, null::uuid; return;
  end if;

  if exists (select 1 from public.allowlist a where a.email = v_email) then
    update public.waitlist set invited_at = now() where email = v_email and invited_at is null;
    return query select 'allowlist'::text, null::uuid; return;
  end if;

  if v_ref is not null then
    select p.id, p.invites_total - (select count(*)::int from public.profiles c where c.invited_by = p.id)
      into v_inviter, v_quota
    from public.profiles p where p.invite_code = v_ref
    for update of p;
    if v_inviter is not null and v_quota > 0 then
      update public.waitlist set invited_at = now() where email = v_email and invited_at is null;
      return query select 'invite'::text, v_inviter; return;
    end if;
  end if;

  -- Registro abierto: cualquier correo nuevo queda invitado (sin consumir cupos de nadie).
  if public.join_open() then
    update public.waitlist set invited_at = now() where email = v_email and invited_at is null;
    return query select 'allowlist'::text, null::uuid; return;
  end if;

  insert into public.waitlist (email, ref_code) values (v_email, v_ref)
  on conflict (email) do nothing;
  return query select 'waitlist'::text, null::uuid;
end;
$$;
revoke execute on function public.join_decision(text, text) from public, anon, authenticated;
