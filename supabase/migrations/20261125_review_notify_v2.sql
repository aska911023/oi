alter table public.site_settings add column if not exists review_email text not null default '';

create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_kind text; v_fire boolean := true;
  v_secret text := (select value from public.app_secrets where key='notify_secret');
begin
  if tg_table_name='claims' then v_kind := 'claim';
  elsif tg_table_name='vendor_applications' then v_kind := 'vendor_app';
  elsif tg_table_name='creator_applications' then v_kind := 'creator_app';
  elsif tg_table_name='happenings' then v_kind := 'happening'; v_fire := not coalesce(new.approved,false);
  elsif tg_table_name='ad_campaigns' then v_kind := 'ad'; v_fire := coalesce(new.status,'')='pending';
  else return new; end if;
  if v_fire and coalesce(v_secret,'') <> '' then
    begin perform net.http_post(
      url := 'https://www.oi-stay.com/api/review-notify',
      body := jsonb_build_object('kind', v_kind, 'id', new.id),
      headers := jsonb_build_object('Content-Type','application/json','x-oi-secret', v_secret)
    ); exception when others then null; end;
  end if;
  return new;
end $fn$;
