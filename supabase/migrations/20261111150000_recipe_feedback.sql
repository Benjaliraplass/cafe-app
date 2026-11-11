-- Feedback post-preparación de una receta guardada (Lote 7c).
-- Una señal por intento (cómo salió la taza) y el ajuste sugerido (regla A01-A24 de la KB).
create table public.recipe_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  signal text not null check (signal in ('acido', 'amargo', 'debil', 'intenso', 'perfecto')),
  note text,
  rule_id text references public.kb_rules (id),
  suggestion text,
  created_at timestamptz not null default now()
);

create index recipe_feedback_recipe_id_idx on public.recipe_feedback (recipe_id, created_at desc);
create index recipe_feedback_user_id_idx on public.recipe_feedback (user_id);
create index recipe_feedback_rule_id_idx on public.recipe_feedback (rule_id);

alter table public.recipe_feedback enable row level security;

create policy "recipe_feedback_select_own" on public.recipe_feedback
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recipe_feedback_insert_own" on public.recipe_feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recipe_feedback_delete_own" on public.recipe_feedback
  for delete to authenticated using (user_id = (select auth.uid()));
