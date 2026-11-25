-- 所有「待審核」項目進來 → email 通知官方信箱(業者申請/創作者/認領/活動投稿/廣告投稿)。
-- 走現有 pg_net → Next route /api/review-notify → Resend(寄 OUSU_ADMIN_EMAILS)。
create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_type text; v_title text; v_href text; v_fire boolean := true;
  v_secret text := (select value from public.app_secrets where key='notify_secret');
begin
  if tg_table_name='claims' then
    v_type := '認領申請'; v_title := coalesce(nullif(new.target_name,''),'店家'); v_href := '/admin/claims';
  elsif tg_table_name='vendor_applications' then
    v_type := '業者上架申請'; v_title := coalesce(nullif(new.business_name,''),'(未填店名)'); v_href := '/admin/vendors';
  elsif tg_table_name='creator_applications' then
    v_type := '創作者申請'; v_title := coalesce(nullif(new.contact_email,''),'創作者'); v_href := '/admin/creators';
  elsif tg_table_name='happenings' then
    v_type := '活動投稿'; v_title := coalesce(nullif(new.title,''),'活動'); v_href := '/admin/events'; v_fire := not coalesce(new.approved,false);
  elsif tg_table_name='ad_campaigns' then
    v_type := '活動廣告投稿'; v_title := coalesce(nullif(new.title,''),'廣告'); v_href := '/admin/ads'; v_fire := coalesce(new.status,'')='pending';
  else return new; end if;

  if v_fire and coalesce(v_secret,'') <> '' then
    begin perform net.http_post(
      url := 'https://www.oi-stay.com/api/review-notify',
      body := jsonb_build_object('type', v_type, 'title', v_title, 'href', v_href),
      headers := jsonb_build_object('Content-Type','application/json','x-oi-secret', v_secret)
    ); exception when others then null; end;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_notify_review on public.claims;
create trigger trg_notify_review after insert on public.claims for each row execute function public.notify_review();
drop trigger if exists trg_notify_review on public.vendor_applications;
create trigger trg_notify_review after insert on public.vendor_applications for each row execute function public.notify_review();
drop trigger if exists trg_notify_review on public.creator_applications;
create trigger trg_notify_review after insert on public.creator_applications for each row execute function public.notify_review();
drop trigger if exists trg_notify_review on public.happenings;
create trigger trg_notify_review after insert on public.happenings for each row execute function public.notify_review();
drop trigger if exists trg_notify_review on public.ad_campaigns;
create trigger trg_notify_review after insert on public.ad_campaigns for each row execute function public.notify_review();
