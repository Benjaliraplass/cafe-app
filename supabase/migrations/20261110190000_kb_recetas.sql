-- Base de conocimiento de recetas (SPEC §9): fuentes, métodos, recetas, pasos y reglas.
-- Origen: docs/kb/coffee_kb_research_y_recetas.xlsx (v1.0, 2026-11-10). Seed: supabase/seed/kb_2026_11.sql.
-- Lectura pública (anon y authenticated): es contenido editorial con atribución. Escritura solo admin.

create table public.kb_sources (
  id             text primary key,                    -- S001
  editor         text,
  author         text,
  title          text,
  kind           text,
  year           int,
  url            text,
  warning        text,
  consulted_at   date,
  url_status     int,                                 -- último código HTTP observado (null = no verificado)
  url_checked_at timestamptz,
  created_at     timestamptz not null default now()
);

create table public.kb_methods (
  id            text primary key,                     -- "V60", "AeroPress"...
  physics       text,                                 -- percolación / inmersión / híbrido / presurizado
  geometry      text,
  filter        text,
  difficulty    text,
  ratio_type    text,                                 -- filtro (agua/café) o espresso (bebida/café)
  ratio_note    text,                                 -- rango descriptivo, no prescriptivo
  distinctive   text,
  source_id     text references public.kb_sources (id),
  url           text,
  sort_order    int not null default 100
);

create table public.kb_recipes (
  id               text primary key,                  -- V60-001
  method_id        text not null references public.kb_methods (id),
  submethod        text,
  name             text not null,
  author           text,
  source_id        text references public.kb_sources (id),
  evidence         text check (evidence in ('A', 'B', 'C')),
  role             text not null check (role in ('base', 'contextual', 'competicion', 'revisar')),
  dose_g           numeric(6, 2),
  dose_max_g       numeric(6, 2),
  brew_water_g     numeric(7, 2),
  water_max_g      numeric(7, 2),
  bypass_water_g   numeric(7, 2),
  ice_g            numeric(7, 2),
  beverage_out_g   numeric(7, 2),
  temp_min_c       numeric(5, 1),
  temp_max_c       numeric(5, 1),
  grind            text,
  time_min_s       int,
  time_max_s       int,
  ratio_brew       numeric(6, 2),                     -- agua de infusión / café
  ratio_espresso   numeric(6, 2),                     -- bebida / café
  roast            text,
  target_profile   text,
  gear             text,
  why              text,
  limits           text,
  url              text,
  verified_at      date,
  is_featured      boolean not null default false,
  sort_order       int not null default 100,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.kb_recipe_steps (
  id                 text primary key,                -- V60-001-01
  recipe_id          text not null references public.kb_recipes (id) on delete cascade,
  step_order         int not null,
  t_from_start_s     int,
  phase              text,
  add_water_g        numeric(7, 2),
  cumulative_water_g numeric(7, 2),
  temp_c             numeric(5, 1),
  instruction        text not null,
  why                text,
  source_id          text references public.kb_sources (id),
  url                text
);

create table public.kb_rules (
  id          text primary key,                       -- P01, A01, PB_ROL
  kind        text not null check (kind in ('principle', 'adjustment', 'prompt_block')),
  title       text,
  rule        text,                                   -- principio / instrucción del bloque
  category    text,
  signal      text,                                   -- ajustes: síntoma observado
  method      text,
  hypothesis  text,
  action      text,
  variable    text,
  magnitude   text,
  outcome     text,
  caveat      text,
  source_id   text references public.kb_sources (id),
  confidence  text
);

create index kb_methods_source_idx on public.kb_methods (source_id);
create index kb_recipes_method_idx on public.kb_recipes (method_id);
create index kb_recipes_source_idx on public.kb_recipes (source_id);
create index kb_recipes_role_idx on public.kb_recipes (role);
create index kb_recipe_steps_recipe_idx on public.kb_recipe_steps (recipe_id, step_order);
create index kb_recipe_steps_source_idx on public.kb_recipe_steps (source_id);
create index kb_rules_source_idx on public.kb_rules (source_id);
create index kb_rules_kind_idx on public.kb_rules (kind);

alter table public.kb_sources enable row level security;
alter table public.kb_methods enable row level security;
alter table public.kb_recipes enable row level security;
alter table public.kb_recipe_steps enable row level security;
alter table public.kb_rules enable row level security;

create policy kb_sources_select on public.kb_sources for select to anon, authenticated using (true);
create policy kb_methods_select on public.kb_methods for select to anon, authenticated using (true);
create policy kb_recipes_select on public.kb_recipes for select to anon, authenticated using (true);
create policy kb_recipe_steps_select on public.kb_recipe_steps for select to anon, authenticated using (true);
create policy kb_rules_select on public.kb_rules for select to anon, authenticated using (true);

create policy kb_sources_admin on public.kb_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy kb_methods_admin on public.kb_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy kb_recipes_admin on public.kb_recipes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy kb_recipe_steps_admin on public.kb_recipe_steps for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy kb_rules_admin on public.kb_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger kb_recipes_updated_at before update on public.kb_recipes
  for each row execute function public.set_updated_at();
