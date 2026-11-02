-- 政策調整:已核准業者(role='partner')上架民宿/租車「自動公開」,不再逐筆審核(只審業者申請)。
-- 業者仍不可自封精選(featured)/方案(ad_tier);admin 與 partner 以外者維持強制未上架。
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
    end if;
    return new;
  end if;
  if tg_op='INSERT' then
    new.published := false; new.approved := false;
    if tg_table_name='stays' then new.featured := false; new.ad_tier := 'free';
    elsif tg_table_name='rental_shops' then new.featured := false; end if;
  elsif tg_op='UPDATE' then
    new.published := old.published; new.approved := old.approved;
    if tg_table_name='stays' then new.visibility := old.visibility; new.featured := old.featured; new.ad_tier := old.ad_tier;
    elsif tg_table_name='rental_shops' then new.featured := old.featured; end if;
  end if;
  return new;
end $fn$;
