-- Equipo del usuario para personalizar recetas:
-- { grinder: text, drippers: text[], espresso_machine: text, other: text }
alter table public.profiles
  add column if not exists equipment jsonb not null default '{}'::jsonb;
