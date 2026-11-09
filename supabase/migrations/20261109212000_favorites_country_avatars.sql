-- Favoritos en el diario
alter table public.coffee_logs
  add column if not exists is_favorite boolean not null default false;
create index if not exists coffee_logs_user_fav_idx on public.coffee_logs (user_id) where is_favorite;

-- Nacionalidad en el perfil (código ISO-3166 alpha-2, ej. 'CL')
alter table public.profiles
  add column if not exists country text;

-- Bucket público de avatares: cada usuario escribe solo en su carpeta {uid}/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_select_public" on storage.objects
  for select to authenticated, anon using (bucket_id = 'avatars');
create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
