-- 一致性+安全:把 guard_publish_flags 擴到 餐廳/娛樂/外燴(原本只守民宿/租車)。
-- 業者自家據點自動上架,但不可自封精選(featured)/方案(ad_tier)/審核(approved);非業者強制未上架。
CREATE OR REPLACE FUNCTION public.guard_publish_flags() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
begin
  if is_admin() or auth.uid() is null then return new; end if;
  if exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='partner') then
    if tg_table_name='stays' then
      new.approved := true; new.visibility := 'published';
      if tg_op='INSERT' then new.published := true; new.featured := false; new.ad_tier := 'free';
      else new.featured := old.featured; new.ad_tier := old.ad_tier; end if;
    elsif tg_table_name='rental_shops' then
      if tg_op='INSERT' then new.published := true; new.featured := false;
      else new.featured := old.featured; end if;
    elsif tg_table_name in ('restaurants','activities','caterings') then
      new.approved := true;
      if tg_op='INSERT' then new.published := true; new.featured := false; new.ad_tier := 'free';
      else new.featured := old.featured; new.ad_tier := old.ad_tier; end if;
    end if;
    return new;
  end if;
  -- 非業者非管理員:強制未上架
  if tg_op='INSERT' then
    new.published := false;
    if tg_table_name='stays' then new.approved := false; new.featured := false; new.ad_tier := 'free';
    elsif tg_table_name='rental_shops' then new.featured := false;
    elsif tg_table_name in ('restaurants','activities','caterings') then new.approved := false; new.featured := false; new.ad_tier := 'free'; end if;
  elsif tg_op='UPDATE' then
    new.published := old.published;
    if tg_table_name='stays' then new.approved := old.approved; new.visibility := old.visibility; new.featured := old.featured; new.ad_tier := old.ad_tier;
    elsif tg_table_name='rental_shops' then new.featured := old.featured;
    elsif tg_table_name in ('restaurants','activities','caterings') then new.approved := old.approved; new.featured := old.featured; new.ad_tier := old.ad_tier; end if;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_guard_publish_flags on public.restaurants;
create trigger trg_guard_publish_flags before insert or update on public.restaurants for each row execute function public.guard_publish_flags();
drop trigger if exists trg_guard_publish_flags on public.activities;
create trigger trg_guard_publish_flags before insert or update on public.activities for each row execute function public.guard_publish_flags();
drop trigger if exists trg_guard_publish_flags on public.caterings;
create trigger trg_guard_publish_flags before insert or update on public.caterings for each row execute function public.guard_publish_flags();
