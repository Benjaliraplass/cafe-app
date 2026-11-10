-- Capa de eventos y métricas derivadas (SPEC §8).
-- events: append-only, sin lectura desde el cliente. Escritura solo vía track_event().
-- Lecturas agregadas: funciones admin_* (security definer, exigen is_admin()).

create table public.events (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  user_id       uuid references auth.users (id) on delete set null,
  anonymous_id  text,
  session_id    text,
  name          text not null check (name ~ '^[a-z_]{3,40}$'),
  props         jsonb not null default '{}'::jsonb,
  path          text,
  display_mode  text,
  device        text,
  app_version   text,
  utm           jsonb,
  ref           text
);

comment on table public.events is 'Eventos de producto (analítica). Append-only; sin PII en props.';

alter table public.events enable row level security;
-- Sin políticas: ni anon ni authenticated leen o escriben directo.

create index events_name_ts_idx on public.events (name, ts desc);
create index events_user_ts_idx on public.events (user_id, ts desc);
create index events_anon_idx on public.events (anonymous_id);
create index events_ts_idx on public.events (ts desc);

-- Escritura: RPC que fija user_id = auth.uid() y valida tamaños.
create or replace function public.track_event(
  p_name          text,
  p_props         jsonb default '{}'::jsonb,
  p_anonymous_id  text default null,
  p_session_id    text default null,
  p_path          text default null,
  p_display_mode  text default null,
  p_device        text default null,
  p_app_version   text default null,
  p_utm           jsonb default null,
  p_ref           text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name is null or p_name !~ '^[a-z_]{3,40}$' then
    raise exception 'nombre de evento inválido';
  end if;
  if pg_column_size(coalesce(p_props, '{}'::jsonb)) > 4096 then
    raise exception 'props demasiado grande';
  end if;
  insert into public.events (user_id, anonymous_id, session_id, name, props, path, display_mode, device, app_version, utm, ref)
  values (
    auth.uid(),
    left(p_anonymous_id, 64),
    left(p_session_id, 64),
    p_name,
    coalesce(p_props, '{}'::jsonb),
    left(p_path, 200),
    left(p_display_mode, 20),
    left(p_device, 20),
    left(p_app_version, 20),
    p_utm,
    left(p_ref, 16)
  );
end
$$;

revoke all on function public.track_event(text, jsonb, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.track_event(text, jsonb, text, text, text, text, text, text, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Derivados (solo admin)
-- ---------------------------------------------------------------------------

create or replace function public.admin_user_facts()
returns table (
  user_id             uuid,
  email               text,
  provider            text,
  display_name        text,
  country             text,
  role                text,
  created_at          timestamptz,
  utm                 jsonb,
  ref                 text,
  first_path          text,
  device              text,
  display_mode        text,
  first_scan_at       timestamptz,
  first_log_at        timestamptz,
  first_recipe_at     timestamptz,
  first_share_at      timestamptz,
  hours_to_first_log  numeric,
  logs_count          int,
  scans_count         int,
  recipes_count       int,
  saved_recipes_count int,
  favorites_count     int,
  public_logs_count   int,
  cafes_proposed      int,
  distinct_roasters   int,
  distinct_origins    int,
  avg_rating          numeric,
  last_active_at      timestamptz,
  active_days_7d      int,
  active_days_30d     int,
  events_count        int,
  shares_sent         int,
  share_opens         int,
  signups_referred    int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;
  return query
  with first_ev as (
    select distinct on (e.user_id) e.user_id, e.utm, e.ref, e.path, e.device, e.display_mode
    from public.events e
    where e.user_id is not null
    order by e.user_id, e.ts
  ),
  ev as (
    select e.user_id,
      min(e.ts) filter (where e.name = 'scan_completed')   as first_scan_at,
      min(e.ts) filter (where e.name = 'recipe_generated') as first_recipe_at,
      min(e.ts) filter (where e.name = 'share_clicked')    as first_share_at,
      count(*) filter (where e.name = 'scan_completed')::int   as scans_count,
      count(*) filter (where e.name = 'recipe_generated')::int as recipes_count,
      count(*) filter (where e.name = 'share_clicked')::int    as shares_sent,
      max(e.ts) as last_active_at,
      count(distinct date_trunc('day', e.ts)) filter (where e.ts > now() - interval '7 days')::int  as active_days_7d,
      count(distinct date_trunc('day', e.ts)) filter (where e.ts > now() - interval '30 days')::int as active_days_30d,
      count(*)::int as events_count
    from public.events e
    where e.user_id is not null
    group by e.user_id
  ),
  logs as (
    select l.user_id,
      min(l.created_at) as first_log_at,
      count(*)::int as logs_count,
      count(*) filter (where l.is_favorite)::int as favorites_count,
      count(*) filter (where l.is_public)::int as public_logs_count,
      count(distinct c.roaster_id)::int as distinct_roasters,
      count(distinct c.origin_country)::int as distinct_origins,
      round(avg(l.rating) filter (where l.rating > 0), 2) as avg_rating
    from public.coffee_logs l
    left join public.coffees c on c.id = l.coffee_id
    group by l.user_id
  ),
  saved as (
    select r.user_id, count(*)::int as saved_recipes_count from public.recipes r group by r.user_id
  ),
  caf as (
    select cf.created_by as user_id, count(*)::int as cafes_proposed from public.cafes cf where cf.created_by is not null group by cf.created_by
  ),
  viral as (
    select e.ref,
      count(*) filter (where e.name = 'share_link_opened')::int as share_opens,
      count(*) filter (where e.name = 'signup_completed')::int  as signups_referred
    from public.events e
    where e.ref is not null
    group by e.ref
  )
  select
    u.id,
    u.email::text,
    (u.raw_app_meta_data ->> 'provider')::text,
    p.display_name,
    p.country,
    p.role,
    u.created_at,
    fe.utm,
    fe.ref,
    fe.path,
    fe.device,
    fe.display_mode,
    ev.first_scan_at,
    lg.first_log_at,
    ev.first_recipe_at,
    ev.first_share_at,
    round(extract(epoch from (lg.first_log_at - u.created_at)) / 3600, 1),
    coalesce(lg.logs_count, 0),
    coalesce(ev.scans_count, 0),
    coalesce(ev.recipes_count, 0),
    coalesce(sv.saved_recipes_count, 0),
    coalesce(lg.favorites_count, 0),
    coalesce(lg.public_logs_count, 0),
    coalesce(cf.cafes_proposed, 0),
    coalesce(lg.distinct_roasters, 0),
    coalesce(lg.distinct_origins, 0),
    lg.avg_rating,
    ev.last_active_at,
    coalesce(ev.active_days_7d, 0),
    coalesce(ev.active_days_30d, 0),
    coalesce(ev.events_count, 0),
    coalesce(ev.shares_sent, 0),
    coalesce(vr.share_opens, 0),
    coalesce(vr.signups_referred, 0)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join first_ev fe on fe.user_id = u.id
  left join ev on ev.user_id = u.id
  left join logs lg on lg.user_id = u.id
  left join saved sv on sv.user_id = u.id
  left join caf cf on cf.user_id = u.id
  left join viral vr on vr.ref = left(u.id::text, 8)
  order by u.created_at desc;
end
$$;

create or replace function public.admin_daily_metrics(p_days int default 30)
returns table (
  day          date,
  signups      int,
  active_users int,
  scans        int,
  logs         int,
  recipes      int,
  shares       int,
  share_opens  int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;
  return query
  with days as (
    select d::date as day from generate_series((current_date - (p_days - 1))::timestamp, current_date::timestamp, interval '1 day') d
  ),
  su as (
    select u.created_at::date as day, count(*)::int as n from auth.users u group by 1
  ),
  ev as (
    select e.ts::date as day,
      count(distinct coalesce(e.user_id::text, e.anonymous_id))::int as active_users,
      count(*) filter (where e.name = 'scan_completed')::int    as scans,
      count(*) filter (where e.name = 'recipe_generated')::int  as recipes,
      count(*) filter (where e.name = 'share_clicked')::int     as shares,
      count(*) filter (where e.name = 'share_link_opened')::int as share_opens
    from public.events e
    where e.ts >= current_date - (p_days - 1)
    group by 1
  ),
  lg as (
    select l.created_at::date as day, count(*)::int as n from public.coffee_logs l where l.created_at >= current_date - (p_days - 1) group by 1
  )
  select d.day,
    coalesce(su.n, 0), coalesce(ev.active_users, 0), coalesce(ev.scans, 0), coalesce(lg.n, 0),
    coalesce(ev.recipes, 0), coalesce(ev.shares, 0), coalesce(ev.share_opens, 0)
  from days d
  left join su on su.day = d.day
  left join ev on ev.day = d.day
  left join lg on lg.day = d.day
  order by d.day;
end
$$;

create or replace function public.admin_funnel(p_days int default 30)
returns table (step_order int, step text, users int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;
  return query
  with steps(step_order, step) as (
    values (1, 'app_opened'), (2, 'signup_completed'), (3, 'scan_started'), (4, 'scan_completed'),
           (5, 'log_saved'), (6, 'recipe_requested'), (7, 'share_clicked')
  ),
  ev as (
    select e.name, count(distinct coalesce(e.user_id::text, e.anonymous_id))::int as users
    from public.events e
    where e.ts >= now() - make_interval(days => p_days)
    group by e.name
  )
  select s.step_order, s.step, coalesce(ev.users, 0)
  from steps s left join ev on ev.name = s.step
  order by s.step_order;
end
$$;

create or replace function public.admin_retention(p_weeks int default 12)
returns table (cohort_week date, cohort_size int, week_n int, active_users int, pct numeric)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;
  return query
  with users as (
    select u.id, date_trunc('week', u.created_at)::date as cohort_week, u.created_at
    from auth.users u
    where u.created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks - 1)
  ),
  cohorts as (
    select us.cohort_week, count(*)::int as cohort_size from users us group by 1
  ),
  activity as (
    select us.cohort_week,
      floor(extract(epoch from (e.ts - us.created_at)) / (7 * 86400))::int as week_n,
      count(distinct e.user_id)::int as active_users
    from public.events e
    join users us on us.id = e.user_id
    where e.ts >= us.created_at
    group by 1, 2
  )
  select c.cohort_week, c.cohort_size, a.week_n, a.active_users,
    round(100.0 * a.active_users / nullif(c.cohort_size, 0), 1)
  from cohorts c
  join activity a on a.cohort_week = c.cohort_week
  order by c.cohort_week, a.week_n;
end
$$;

create or replace function public.admin_top(p_days int default 30, p_limit int default 10)
returns table (kind text, id uuid, label text, value int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;
  return query
  (
    select 'coffee_logged'::text, c.id, coalesce(r.name || ' · ', '') || c.name, count(*)::int
    from public.coffee_logs l
    join public.coffees c on c.id = l.coffee_id
    left join public.roasters r on r.id = c.roaster_id
    where l.created_at >= now() - make_interval(days => p_days)
    group by c.id, r.name, c.name
    order by 4 desc limit p_limit
  )
  union all
  (
    select 'roaster_logged'::text, r.id, r.name, count(*)::int
    from public.coffee_logs l
    join public.coffees c on c.id = l.coffee_id
    join public.roasters r on r.id = c.roaster_id
    where l.created_at >= now() - make_interval(days => p_days)
    group by r.id, r.name
    order by 4 desc limit p_limit
  )
  union all
  (
    select 'coffee_viewed'::text, c.id, coalesce(r.name || ' · ', '') || c.name, count(*)::int
    from public.events e
    join public.coffees c on c.id::text = e.props ->> 'coffee_id'
    left join public.roasters r on r.id = c.roaster_id
    where e.name = 'public_coffee_viewed' and e.ts >= now() - make_interval(days => p_days)
    group by c.id, r.name, c.name
    order by 4 desc limit p_limit
  )
  union all
  (
    select 'cafe_viewed'::text, cf.id, cf.name, count(*)::int
    from public.events e
    join public.cafes cf on cf.id::text = e.props ->> 'cafe_id'
    where e.name in ('cafe_viewed', 'cafe_maps_clicked') and e.ts >= now() - make_interval(days => p_days)
    group by cf.id, cf.name
    order by 4 desc limit p_limit
  );
end
$$;

revoke all on function public.admin_user_facts() from public;
revoke all on function public.admin_daily_metrics(int) from public;
revoke all on function public.admin_funnel(int) from public;
revoke all on function public.admin_retention(int) from public;
revoke all on function public.admin_top(int, int) from public;
grant execute on function public.admin_user_facts() to authenticated;
grant execute on function public.admin_daily_metrics(int) to authenticated;
grant execute on function public.admin_funnel(int) to authenticated;
grant execute on function public.admin_retention(int) to authenticated;
grant execute on function public.admin_top(int, int) to authenticated;
