-- 單一民宿數據分析:總覽(含前期對比)+ 每日趨勢 + 訂房狀態 + 轉換漏斗用料。業者本人或 admin 可讀。
CREATE OR REPLACE FUNCTION public.stay_analytics(p_stay_id uuid, p_days int default 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare v_owner uuid;
  v_from timestamptz := now() - (p_days || ' days')::interval;
  v_prev timestamptz := now() - (2 * p_days || ' days')::interval;
  res jsonb;
begin
  select owner_id into v_owner from public.stays where id = p_stay_id;
  if not (public.is_admin() or v_owner = auth.uid()) then raise exception '無權限查看此民宿數據'; end if;

  with ev as (select type, created_at from public.events where stay_id = p_stay_id and created_at >= v_prev),
  cur as (select * from ev where created_at >= v_from),
  prv as (select * from ev where created_at < v_from),
  bk as (select status, total, deposit_amount, created_at from public.bookings where stay_id = p_stay_id),
  bkc as (select * from bk where created_at >= v_from),
  d as (select generate_series(0, p_days - 1) as n)
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
end $fn$;
REVOKE ALL ON FUNCTION public.stay_analytics(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.stay_analytics(uuid, int) TO authenticated;
