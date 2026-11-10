-- El autor puede editar su cafetería mientras esté pendiente, pero no cambiar su estado (QA del lote 3 detectó el hueco).
drop policy if exists "cafes_update_creator_pending" on public.cafes;
create policy "cafes_update_creator_pending" on public.cafes
  for update to authenticated
  using ((select auth.uid()) = created_by and status = 'pending')
  with check ((select auth.uid()) = created_by and status = 'pending');
