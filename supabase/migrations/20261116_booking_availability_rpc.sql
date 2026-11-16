-- 給前台 BookNow 用:回傳某民宿在指定日期區間,每個房型的「真實剩餘數」(有效房間數−已訂)、是否休、區間總價。
-- DEFINER 繞過 bookings RLS(消費者讀不到別人訂單),但只回數字不回訂單明細,無隱私外洩。
CREATE OR REPLACE FUNCTION public.booking_availability(p_stay_id uuid, p_check_in date, p_check_out date)
RETURNS TABLE(room_type_id uuid, available int, closed boolean, price numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare rt record; d date; av record; v_inv int; v_booked int; v_cap int; v_closed boolean; v_price numeric;
begin
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then return; end if;
  for rt in select rtp.id, rtp.price, rtp.rooms_total, rtp.kind from public.room_types rtp where rtp.stay_id = p_stay_id and rtp.published loop
    v_cap := null; v_closed := false; v_price := 0;
    for d in select gs::date from generate_series(p_check_in::timestamp, (p_check_out - 1)::timestamp, interval '1 day') gs loop
      select ra.closed, ra.inventory, ra.price_override into av from public.room_availability ra where ra.room_type_id = rt.id and ra.date = d;
      if coalesce(av.closed, false) then v_closed := true; end if;
      v_price := v_price + coalesce(av.price_override, rt.price, 0);
      v_inv := coalesce(av.inventory, rt.rooms_total, case when rt.kind='whole' then 1 else null end);
      if v_inv is not null then
        select coalesce(sum(br.qty), 0) into v_booked
          from public.booking_rooms br join public.bookings b on b.id = br.booking_id
          where br.room_type_id = rt.id and b.check_in <= d and b.check_out > d
            and b.status in ('pending','confirmed','deposit_reported','booked','checked_in');
        v_cap := least(coalesce(v_cap, v_inv - v_booked), v_inv - v_booked);
      end if;
    end loop;
    room_type_id := rt.id;
    available := case when v_cap is null then null else greatest(v_cap, 0) end;
    closed := v_closed;
    price := v_price;
    return next;
  end loop;
end $fn$;
REVOKE ALL ON FUNCTION public.booking_availability(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.booking_availability(uuid, date, date) TO anon, authenticated;
