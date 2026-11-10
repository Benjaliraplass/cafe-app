-- Enlace directo a la ficha del local en Google Maps (fotos, horario, reseñas). Formato: https://maps.google.com/?cid=<id>
alter table public.cafes add column if not exists google_maps_url text;
