-- QA de lanzamiento (2026-11-13): el Gate manda a "Crea tu cuenta" a todo invitado (user_metadata.source)
-- sin `password_set`. Los invitados que ya crearon contraseña antes de este cambio se marcan aquí para
-- que no se les vuelva a pedir.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"password_set": true}'::jsonb
where raw_user_meta_data ? 'source'
  and coalesce(encrypted_password, '') <> '';
