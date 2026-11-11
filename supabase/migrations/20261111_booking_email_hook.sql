-- email 通知接口:notify_booking_change 在寫站內通知之外,用 pg_net 打 Next route /api/booking-notify。
-- 共享密鑰存私有表 app_secrets(RLS 無政策 → anon/authenticated 讀不到,DEFINER 繞過;不進 git);
-- Next route 以 env OI_NOTIFY_SECRET 比對。未設密鑰 → 不呼叫(站內鈴鐺通知照常)。pg_net fire-and-forget 不阻塞交易。
create table if not exists public.app_secrets (key text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

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
    v_event := new.status;
    if new.created_by is not null then
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
  end if;

  -- email:設了密鑰才打(fire-and-forget);失敗不影響訂房
  if v_event is not null and coalesce(v_secret,'') <> '' then
    begin perform net.http_post(
      url := v_url,
      body := jsonb_build_object('booking_id', new.id, 'event', v_event),
      headers := jsonb_build_object('Content-Type','application/json','x-oi-secret', v_secret)
    ); exception when others then null; end;
  end if;

  return new;
end $fn$;
