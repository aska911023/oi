-- 授權方案(期間限定曝光):開始/結束日期 + 到期自動降免費
-- 讀取時判斷(search_rooms 看日期)+ 每日 cron 備援(把過期的 ad_tier/featured 洗乾淨)
alter table public.stays add column if not exists ad_start date;
alter table public.stays add column if not exists ad_end   date;

-- search_rooms:prio 的 ad_tier 曝光改成「且在授權日期區間內」才算(過期/未開始=不吃曝光)
create or replace function public.search_rooms(
  kw text default ''::text,
  p_region text default null::text,
  p_price_min integer default null::integer,
  p_price_max integer default null::integer,
  p_guests integer default null::integer,
  p_category text default null::text,
  p_amenities text[] default null::text[],
  p_room_tags text[] default null::text[],
  p_sort text default 'default'::text,
  lim integer default 24,
  off integer default 0,
  p_regions text[] default null::text[]
) returns jsonb language sql stable as $function$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.rooms_total, rt.kind, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image,
           coalesce(nullif(rt.images,'{}'), nullif(s.images,'{}'),
                    array_remove(array[nullif(rt.image,''), nullif(s.image,'')], null)) as images,
           rt.featured, s.ad_tier,
           (public.room_save_count(rt.id) + coalesce(s.save_boost, 0))::int as save_count,
           s.id as stay_id, s.slug as stay_slug, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at,
           (coalesce(nullif(rt.image,''), nullif(s.image,'')) is not null
             or coalesce(array_length(rt.images,1),0) > 0 or coalesce(array_length(s.images,1),0) > 0) as has_image,
           ((case when s.ad_tier <> 'free'
                   and (s.ad_start is null or s.ad_start <= current_date)
                   and (s.ad_end   is null or s.ad_end   >= current_date) then 1 else 0 end)
            + (case when rt.kind = 'whole' then 1 else 0 end)) as prio
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_regions is null or s.region = any(p_regions))
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (p_room_tags is null or rt.tags @> p_room_tags)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by
      has_image desc,
      case when p_sort='default' then prio end desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      prio desc, featured desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$function$;

-- 每日 cron 備援:把已過期的授權洗回免費(讀取端已正確,這只是把 stored featured/ad_tier 清乾淨,讓 stays 列表排序也對)
do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('oi-revert-expired-ad'); exception when others then null; end;
    perform cron.schedule('oi-revert-expired-ad', '10 0 * * *',
      $cron$update public.stays set ad_tier='free', featured=false, ad_start=null, ad_end=null where ad_end is not null and ad_end < current_date$cron$);
  end if;
end $$;
