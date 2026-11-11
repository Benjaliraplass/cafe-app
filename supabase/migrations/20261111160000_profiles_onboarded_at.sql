-- Walkthrough de bienvenida: se muestra una vez por cuenta. Null = pendiente.
alter table public.profiles add column onboarded_at timestamptz;
-- Cuentas existentes ya conocen la app: no mostrarles el walkthrough.
update public.profiles set onboarded_at = now() where onboarded_at is null;
