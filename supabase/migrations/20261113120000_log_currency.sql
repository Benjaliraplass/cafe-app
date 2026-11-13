-- Lote 11: precio en cualquier moneda. `price_clp` pasa a numeric (acepta decimales para USD/EUR)
-- y `currency` guarda el código ISO. El nombre de la columna se mantiene por compatibilidad.
alter table public.coffee_logs
  alter column price_clp type numeric(12, 2) using price_clp::numeric,
  add column if not exists currency text not null default 'CLP'
    check (currency in ('CLP', 'USD', 'EUR', 'ARS', 'PEN', 'COP', 'MXN', 'BRL', 'UYU', 'BOB', 'PYG', 'GBP'));
comment on column public.coffee_logs.price_clp is 'Monto pagado en la moneda de `currency` (nombre histórico).';
