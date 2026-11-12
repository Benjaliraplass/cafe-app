-- Lote 10: sincronización diaria de la lista blanca (Shopify -> allowlist) con pg_cron + pg_net.
-- La clave compartida vive en Vault (nombre `sync_key`): la lee el cron para firmar la llamada y la
-- Edge Function sync-allowlist para validarla. El valor se crea a mano en Supabase -> Vault (no está en el repo).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Clave compartida (solo service role / cron). Valor: secreto `sync_key` creado en el dashboard (Vault).
create or replace function public.sync_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'sync_key' limit 1;
$$;
revoke execute on function public.sync_key() from public, anon, authenticated;

-- Todos los días a las 06:10 UTC (03:10 Chile).
select cron.unschedule(jobid) from cron.job where jobname = 'sync-allowlist';
select cron.schedule(
  'sync-allowlist',
  '10 6 * * *',
  $$
  select net.http_post(
    url := 'https://pfpqqwvnfusxrttajndu.supabase.co/functions/v1/sync-allowlist',
    headers := jsonb_build_object('content-type', 'application/json', 'x-sync-key', public.sync_key()),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
