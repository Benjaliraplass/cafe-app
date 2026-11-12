-- Lote 10: la lista blanca la sincroniza n8n (Klaviyo -> Edge Function sync-allowlist con SYNC_KEY).
-- Se retiran el cron de pg_cron y la función que leía Vault (migración 20261112120200).
select cron.unschedule(jobid) from cron.job where jobname = 'sync-allowlist';
drop function if exists public.sync_key();
