-- Las funciones admin_* solo las llaman usuarios con sesión (y dentro exigen is_admin()).
revoke execute on function public.admin_user_facts() from anon;
revoke execute on function public.admin_daily_metrics(int) from anon;
revoke execute on function public.admin_funnel(int) from anon;
revoke execute on function public.admin_retention(int) from anon;
revoke execute on function public.admin_top(int, int) from anon;
