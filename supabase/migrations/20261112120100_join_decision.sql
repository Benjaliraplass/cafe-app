-- Lote 10: decisión de ingreso para la Edge Function `join` (solo service role).
-- Devuelve: exists (ya tiene cuenta) | allowlist (cliente de Tostado Club) | invite (código con cupo)
-- | waitlist (queda en lista de espera). La creación de la cuenta y el correo los hace la función.

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
begin
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
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

  insert into public.waitlist (email, ref_code) values (v_email, v_ref)
  on conflict (email) do nothing;
  return query select 'waitlist'::text, null::uuid;
end;
$$;
revoke execute on function public.join_decision(text, text) from public, anon, authenticated;
