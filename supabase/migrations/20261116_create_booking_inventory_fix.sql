-- 修正超賣:有效房間數=room_availability.inventory(當日覆蓋)否則 room_types.rooms_total,
-- 再扣掉該日已被訂走的數量(active 訂單:pending/confirmed/deposit_reported/booked/checked_in)。
CREATE OR REPLACE FUNCTION public.create_booking(p_stay_id uuid, p_check_in date, p_check_out date, p_adults integer, p_children integer, p_guest_name text, p_guest_phone text, p_guest_email text, p_note text, p_rooms jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_uid uuid := auth.uid(); v_enabled boolean; v_pct numeric; v_nights int; v_code text;
  v_bid uuid; v_sub numeric := 0; v_dep numeric := 0; r jsonb; rt record; v_qty int; v_line numeric;
  d date; av record; v_cap int; v_inv int; v_booked int;
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
    select id, name, price, rooms_total, kind into rt from public.room_types where id=(r->>'room_type_id')::uuid and stay_id=p_stay_id;
    if rt.id is null then continue; end if;
    v_line := 0; v_cap := null;
    for d in select gs::date from generate_series(p_check_in::timestamp, (p_check_out - 1)::timestamp, interval '1 day') gs loop
      select closed, inventory, price_override into av from public.room_availability where room_type_id=rt.id and date=d;
      if coalesce(av.closed,false) then raise exception '房型「%」在 % 已休,無法訂房', rt.name, to_char(d,'MM/DD'); end if;
      v_line := v_line + coalesce(av.price_override, rt.price, 0);
      v_inv := coalesce(av.inventory, rt.rooms_total, case when rt.kind='whole' then 1 else null end);  -- 有效房間數:日曆>房型總數>包棟預設1間
      if v_inv is not null then
        select coalesce(sum(br.qty),0) into v_booked
          from public.booking_rooms br join public.bookings b on b.id = br.booking_id
          where br.room_type_id = rt.id and b.id <> v_bid
            and b.check_in <= d and b.check_out > d
            and b.status in ('pending','confirmed','deposit_reported','booked','checked_in');
        v_cap := least(coalesce(v_cap, v_inv - v_booked), v_inv - v_booked);
      end if;
    end loop;
    if v_cap is not null and v_qty > v_cap then raise exception '房型「%」該期間僅剩 % 間', rt.name, greatest(v_cap, 0); end if;
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
