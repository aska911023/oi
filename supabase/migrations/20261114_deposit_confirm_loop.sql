-- 訂金確認閉環:A匯款回報 → B核對收到 → 訂房完成(雙方留紀錄,少糾紛)
-- 狀態流:pending → confirmed(待匯訂金) → deposit_reported(待核對訂金) → completed(訂房完成)

alter table public.bookings add column if not exists payer_last5 text;           -- 匯款帳號後五碼
alter table public.bookings add column if not exists payer_name text;            -- 匯款人姓名
alter table public.bookings add column if not exists payer_phone text;           -- 聯絡電話
alter table public.bookings add column if not exists payment_note text;          -- 備註
alter table public.bookings add column if not exists paid_reported_at timestamptz;   -- A 回報時間
alter table public.bookings add column if not exists deposit_confirmed_at timestamptz; -- B 核對時間

-- A(房客本人)回報匯款:bookings RLS 只給 admin/業主,房客走 DEFINER RPC
CREATE OR REPLACE FUNCTION public.report_deposit(p_booking_id uuid, p_last5 text, p_name text, p_phone text, p_note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare v_uid uuid := auth.uid(); v_st text;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  select status into v_st from public.bookings where id=p_booking_id and created_by=v_uid;
  if not found then raise exception '找不到你的這筆訂房'; end if;
  if v_st <> 'confirmed' then raise exception '此訂單目前狀態無法回報匯款'; end if;
  if coalesce(trim(p_last5),'')='' then raise exception '請填寫匯款帳號後五碼'; end if;
  update public.bookings set status='deposit_reported',
    payer_last5=trim(p_last5), payer_name=nullif(trim(p_name),''), payer_phone=nullif(trim(p_phone),''),
    payment_note=nullif(trim(p_note),''), paid_reported_at=now(), updated_at=now()
  where id=p_booking_id;
  begin insert into public.booking_events (booking_id, action, from_status, to_status, actor, note)
    values (p_booking_id, 'deposit_reported', 'confirmed', 'deposit_reported', v_uid, '房客回報匯款 後五碼:'||trim(p_last5));
  exception when others then null; end;
  return 'ok';
end $fn$;
REVOKE ALL ON FUNCTION public.report_deposit(uuid,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_deposit(uuid,text,text,text,text) TO authenticated;

-- 通知路由改版:deposit_reported→通知業者、completed→通知房客「訂房完成」
CREATE OR REPLACE FUNCTION public.notify_booking_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare v_owner uuid; v_name text; v_event text;
  v_url text := 'https://www.oi-stay.com/api/booking-notify';
  v_secret text := (select value from public.app_secrets where key='notify_secret');
begin
  select owner_id, name into v_owner, v_name from public.stays where id = new.stay_id;

  if tg_op='INSERT' and coalesce(new.source,'')='web' then
    v_event := 'new';
    if v_owner is not null then
      begin insert into public.notifications (user_id, kind, title, href)
        values (v_owner, 'booking_new', '新訂房待確認:'||coalesce(new.guest_name,'房客')||' · '||to_char(new.check_in,'MM/DD')||'–'||to_char(new.check_out,'MM/DD')||' ('||new.code||')', '/vendor/bookings');
      exception when others then null; end;
    end if;
  elsif tg_op='UPDATE' and new.status is distinct from old.status then
    if new.status = 'deposit_reported' then
      v_event := 'deposit_reported';
      if v_owner is not null then
        begin insert into public.notifications (user_id, kind, title, href)
          values (v_owner, 'booking_paid', '房客已回報匯款(後五碼 '||coalesce(new.payer_last5,'-')||'):'||coalesce(new.guest_name,'房客')||' ('||new.code||')', '/vendor/bookings');
        exception when others then null; end;
      end if;
    else
      v_event := new.status;
      if new.created_by is not null then
        begin insert into public.notifications (user_id, kind, title, href)
          values (new.created_by, 'booking_status',
            case new.status
              when 'confirmed' then '訂房已確認,請匯訂金:'||coalesce(v_name,'民宿')||' ('||new.code||')'
              when 'booked' then '訂房完成:'||coalesce(v_name,'民宿')||' ('||new.code||')'
              when 'rejected'  then '訂房未成立:'||coalesce(v_name,'民宿')||' ('||new.code||')'
              when 'cancelled' then '訂房已取消:'||coalesce(v_name,'民宿')||' ('||new.code||')'
              when 'checked_in' then '已為你辦理入住:'||coalesce(v_name,'民宿')
              else '訂房狀態更新:'||coalesce(v_name,'民宿')
            end, '/me/bookings');
        exception when others then null; end;
      end if;
    end if;
  end if;

  if v_event is not null and coalesce(v_secret,'') <> '' then
    begin perform net.http_post(
      url := v_url,
      body := jsonb_build_object('booking_id', new.id, 'event', v_event),
      headers := jsonb_build_object('Content-Type','application/json','x-oi-secret', v_secret)
    ); exception when others then null; end;
  end if;

  return new;
end $fn$;

-- my_bookings 加回報欄位(RETURNS TABLE 改簽名要先 DROP)
DROP FUNCTION IF EXISTS public.my_bookings();
CREATE FUNCTION public.my_bookings() RETURNS TABLE(
  id uuid, code text, status text, stay_id uuid, stay_name text, check_in date, check_out date,
  nights int, adults int, children int, total numeric, deposit_amount numeric,
  booking_note text, created_at timestamptz, rooms jsonb, payer_last5 text, paid_reported_at timestamptz
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  select b.id, b.code, b.status, b.stay_id, s.name, b.check_in, b.check_out,
    b.nights, b.adults, b.children, b.total, b.deposit_amount, s.booking_note, b.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('name', br.room_name, 'qty', br.qty)) from public.booking_rooms br where br.booking_id=b.id), '[]'::jsonb),
    b.payer_last5, b.paid_reported_at
  from public.bookings b join public.stays s on s.id=b.stay_id
  where b.created_by = auth.uid()
  order by b.created_at desc limit 100;
$fn$;
REVOKE ALL ON FUNCTION public.my_bookings() FROM public;
GRANT EXECUTE ON FUNCTION public.my_bookings() TO authenticated;
