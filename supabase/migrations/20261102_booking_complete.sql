-- 訂房系統補完:① create_booking 吃房況/特殊日價 ② 新訂單/狀態變更通知 ③ 消費者看自己訂單

-- ① create_booking 硬化:逐晚檢查關閉日/庫存(0 或超剩餘→擋),價格吃 price_override(沒設用底價)
CREATE OR REPLACE FUNCTION public.create_booking(p_stay_id uuid, p_check_in date, p_check_out date, p_adults integer, p_children integer, p_guest_name text, p_guest_phone text, p_guest_email text, p_note text, p_rooms jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_uid uuid := auth.uid(); v_enabled boolean; v_pct numeric; v_nights int; v_code text;
  v_bid uuid; v_sub numeric := 0; v_dep numeric := 0; r jsonb; rt record; v_qty int; v_line numeric;
  d date; av record; v_cap int;
begin
  if v_uid is null then raise exception '請先登入才能訂房'; end if;
  if coalesce(trim(p_guest_name),'')='' or coalesce(trim(p_guest_phone),'')='' then raise exception '請填寫姓名與電話'; end if;
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then raise exception '請選擇正確的入住與退房日期'; end if;
  if p_check_in < current_date then raise exception '入住日不可早於今天'; end if;
  select booking_enabled, coalesce(booking_deposit_pct,0) into v_enabled, v_pct
    from public.stays where id=p_stay_id and published and approved and visibility='published';
  if not found then raise exception '民宿不存在或未開放訂房'; end if;
  if not coalesce(v_enabled,false) then raise exception '此民宿尚未開放線上訂房,請改用官方管道'; end if;
  v_nights := p_check_out - p_check_in;
  v_code := 'OI'||to_char(now(),'YYMMDD')||upper(substr(md5(random()::text),1,4));
  insert into public.bookings (stay_id, code, source, status, guest_name, guest_phone, guest_email,
    adults, children, check_in, check_out, nights, subtotal, discount, total, deposit_amount, guest_note, created_by)
    values (p_stay_id, v_code, 'web', 'pending', trim(p_guest_name), trim(p_guest_phone), nullif(trim(p_guest_email),''),
    coalesce(p_adults,1), coalesce(p_children,0), p_check_in, p_check_out, v_nights, 0, 0, 0, 0, nullif(trim(p_note),''), v_uid)
    returning id into v_bid;
  for r in select value from jsonb_array_elements(coalesce(p_rooms,'[]'::jsonb)) loop
    v_qty := greatest(coalesce((r->>'qty')::int,1),1);
    select id, name, price into rt from public.room_types where id=(r->>'room_type_id')::uuid and stay_id=p_stay_id;
    if rt.id is null then continue; end if;
    v_line := 0; v_cap := null;
    for d in select gs::date from generate_series(p_check_in::timestamp, (p_check_out - 1)::timestamp, interval '1 day') gs loop
      select closed, inventory, price_override into av from public.room_availability where room_type_id=rt.id and date=d;
      if coalesce(av.closed,false) then raise exception '房型「%」在 % 已關閉,無法訂房', rt.name, to_char(d,'MM/DD'); end if;
      if av.inventory is not null then
        if av.inventory <= 0 then raise exception '房型「%」在 % 已無空房', rt.name, to_char(d,'MM/DD'); end if;
        v_cap := least(coalesce(v_cap, av.inventory), av.inventory);
      end if;
      v_line := v_line + coalesce(av.price_override, rt.price, 0);
    end loop;
    if v_cap is not null and v_qty > v_cap then raise exception '房型「%」該期間僅剩 % 間', rt.name, v_cap; end if;
    v_line := v_line * v_qty; v_sub := v_sub + v_line;
    insert into public.booking_rooms (booking_id, room_type_id, room_name, qty, nights, unit_price, line_total)
      values (v_bid, rt.id, rt.name, v_qty, v_nights, coalesce(rt.price,0), v_line);
  end loop;
  v_dep := round(v_sub * v_pct / 100);
  update public.bookings set subtotal=v_sub, total=v_sub, deposit_amount=v_dep where id=v_bid;
  begin insert into public.booking_events (booking_id, action, from_status, to_status, actor, note)
    values (v_bid, 'pending', null, 'pending', v_uid, '房客線上訂房'); exception when others then null; end;
  return v_code;
end $function$;

-- ② 通知:新訂單→通知業主;狀態變更→通知房客。走站內 notifications(之後要接 email 再加一層)。
CREATE OR REPLACE FUNCTION public.notify_booking_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare v_owner uuid; v_name text;
begin
  select owner_id, name into v_owner, v_name from public.stays where id = new.stay_id;
  if tg_op='INSERT' and coalesce(new.source,'')='web' then
    if v_owner is not null then
      begin insert into public.notifications (user_id, kind, title, href)
        values (v_owner, 'booking_new', '新訂房待確認:'||coalesce(new.guest_name,'房客')||' · '||to_char(new.check_in,'MM/DD')||'–'||to_char(new.check_out,'MM/DD')||' ('||new.code||')', '/vendor/bookings');
      exception when others then null; end;
    end if;
  elsif tg_op='UPDATE' and new.status is distinct from old.status and new.created_by is not null then
    begin insert into public.notifications (user_id, kind, title, href)
      values (new.created_by, 'booking_status',
        case new.status
          when 'confirmed' then '訂房已確認:'||coalesce(v_name,'民宿')||' ('||new.code||')'
          when 'rejected'  then '訂房未成立:'||coalesce(v_name,'民宿')||' ('||new.code||')'
          when 'cancelled' then '訂房已取消:'||coalesce(v_name,'民宿')||' ('||new.code||')'
          when 'checked_in' then '已為你辦理入住:'||coalesce(v_name,'民宿')
          else '訂房狀態更新:'||coalesce(v_name,'民宿')
        end, '/me/bookings');
    exception when others then null; end;
  end if;
  return new;
end $fn$;
DROP TRIGGER IF EXISTS trg_notify_booking_change ON public.bookings;
CREATE TRIGGER trg_notify_booking_change AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_booking_change();

-- ③ 消費者看自己的訂單(bookings RLS 只給 admin+業主,房客要靠 DEFINER RPC)
CREATE OR REPLACE FUNCTION public.my_bookings() RETURNS TABLE(
  id uuid, code text, status text, stay_id uuid, stay_name text, check_in date, check_out date,
  nights int, adults int, children int, total numeric, deposit_amount numeric,
  booking_note text, created_at timestamptz, rooms jsonb
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  select b.id, b.code, b.status, b.stay_id, s.name, b.check_in, b.check_out,
    b.nights, b.adults, b.children, b.total, b.deposit_amount, s.booking_note, b.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('name', br.room_name, 'qty', br.qty)) from public.booking_rooms br where br.booking_id=b.id), '[]'::jsonb)
  from public.bookings b join public.stays s on s.id=b.stay_id
  where b.created_by = auth.uid()
  order by b.created_at desc limit 100;
$fn$;
REVOKE ALL ON FUNCTION public.my_bookings() FROM public;
GRANT EXECUTE ON FUNCTION public.my_bookings() TO authenticated;
