-- 數據 RPC 加「今日」支援:p_days <= 0 → 當日 00:00 起算(其餘 7/30/90/365 滾動語意不變)
CREATE OR REPLACE FUNCTION public.admin_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ev as (select * from public.events where created_at >= (case when p_days <= 0 then date_trunc('day', now()) else now() - (p_days || ' days')::interval end)),
  totals as (
    select
      count(*) filter (where type='stay_view')::bigint as views,
      count(*) filter (where type='click_website')::bigint as click_web,
      count(*) filter (where type='click_map')::bigint as click_map,
      count(*) filter (where type='click_share')::bigint as shares,
      (select count(*) from public.saved where created_at >= (case when p_days <= 0 then date_trunc('day', now()) else now() - (p_days || ' days')::interval end))::bigint as saves
    from ev
  ),
  top as (
    select s.name, s.ad_tier,
      count(*) filter (where e.type='stay_view')::bigint as views,
      count(*) filter (where e.type='click_website')::bigint as click_web,
      count(*) filter (where e.type='click_share')::bigint as shares,
      (select count(*) from public.saved sv where sv.stay_id=s.id and sv.created_at >= (case when p_days <= 0 then date_trunc('day', now()) else now() - (p_days || ' days')::interval end))::bigint as saves
    from public.stays s left join ev e on e.stay_id = s.id
    group by s.id, s.name, s.ad_tier
    order by views desc nulls last limit 30
  ),
  tiers as (
    select s.ad_tier,
      count(distinct s.id)::bigint as stays,
      count(*) filter (where e.type='stay_view')::bigint as views,
      count(*) filter (where e.type='click_website')::bigint as click_web,
      count(*) filter (where e.type='click_share')::bigint as shares,
      (select count(*) from public.saved sv where sv.created_at >= (case when p_days <= 0 then date_trunc('day', now()) else now() - (p_days || ' days')::interval end)
         and sv.stay_id in (select id from public.stays s2 where s2.ad_tier=s.ad_tier and s2.published and s2.visibility='published'))::bigint as saves
    from public.stays s left join ev e on e.stay_id = s.id
    where s.published and s.visibility='published'
    group by s.ad_tier
  )
  select case when exists (select 1 from public.profiles where id = auth.uid() and role='admin')
    then jsonb_build_object(
      'totals', (select to_jsonb(t) from totals t),
      'top', coalesce((select jsonb_agg(to_jsonb(x)) from top x), '[]'::jsonb),
      'tiers', coalesce((select jsonb_agg(to_jsonb(y)) from tiers y), '[]'::jsonb)
    )
    else jsonb_build_object('error','forbidden') end;
$function$;

CREATE OR REPLACE FUNCTION public.stay_analytics(p_stay_id uuid, p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid;
  v_from timestamptz := case when p_days <= 0 then date_trunc('day', now()) else now() - (p_days || ' days')::interval end;
  v_prev timestamptz := case when p_days <= 0 then date_trunc('day', now()) - interval '1 day' else now() - (2 * p_days || ' days')::interval end;
  v_span int := greatest(p_days, 1);
  res jsonb;
begin
  select owner_id into v_owner from public.stays where id = p_stay_id;
  if not (public.is_admin() or v_owner = auth.uid()) then raise exception '無權限查看此民宿數據'; end if;

  with ev as (select type, created_at from public.events where stay_id = p_stay_id and created_at >= v_prev),
  cur as (select * from ev where created_at >= v_from),
  prv as (select * from ev where created_at < v_from),
  bk as (select status, total, deposit_amount, created_at from public.bookings where stay_id = p_stay_id),
  bkc as (select * from bk where created_at >= v_from),
  d as (select generate_series(0, v_span - 1) as n)
  select jsonb_build_object(
    'days', p_days,
    'views',       (select count(*) from cur where type='stay_view'),
    'clicks_web',  (select count(*) from cur where type='click_website'),
    'clicks_line', (select count(*) from cur where type='click_line'),
    'clicks_map',  (select count(*) from cur where type='click_map'),
    'saves',       (select count(*) from public.saved where stay_id = p_stay_id),
    'bookings',    (select count(*) from bkc),
    'completed',   (select count(*) from bkc where status='booked'),
    'prev_views',    (select count(*) from prv where type='stay_view'),
    'prev_bookings', (select count(*) from bk where created_at >= v_prev and created_at < v_from),
    'revenue_booked', (select coalesce(sum(total),0) from bk where status='booked'),
    'deposit_booked', (select coalesce(sum(deposit_amount),0) from bk where status='booked'),
    'status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from bk group by status) z), '{}'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
        'd', to_char((now()::date - n), 'MM/DD'),
        'views',    (select count(*) from cur where type='stay_view' and created_at::date = (now()::date - n)),
        'bookings', (select count(*) from bkc where created_at::date = (now()::date - n))
      ) order by n desc) from d), '[]'::jsonb)
  ) into res;
  return res;
end $function$;

CREATE OR REPLACE FUNCTION public.traffic_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare since timestamptz := case when p_days <= 0 then date_trunc('day', now()) else now() - (p_days || ' days')::interval end; result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'views', (select count(*) from page_views where created_at >= since),
    'sessions', (select count(distinct session_id) from page_views where created_at >= since),
    'by_source', (select coalesce(jsonb_agg(jsonb_build_object('source',source,'sessions',s) order by s desc),'[]'::jsonb)
                  from (select source, count(distinct session_id) s from page_views where created_at >= since group by source) a),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path',path,'views',v) order by v desc),'[]'::jsonb)
                  from (select path, count(*) v from page_views where created_at >= since group by path order by count(*) desc limit 15) b),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day',d,'views',v) order by d),'[]'::jsonb)
              from (select date_trunc('day',created_at)::date d, count(*) v from page_views where created_at >= since group by 1) c)
  ) into result;
  return result;
end;
$function$;
