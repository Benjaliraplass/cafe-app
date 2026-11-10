-- is_admin() se usa en políticas que también aplican a anon (featured_recipes). Devuelve false sin sesión.
grant execute on function public.is_admin() to anon;
