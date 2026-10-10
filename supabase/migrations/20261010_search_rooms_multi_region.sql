-- search_rooms:新增 p_regions text[](多選縣市)。body 與原版逐字相同,只多一行 region = any(p_regions) 過濾。
-- 先 DROP 舊簽章再建(加參數會改簽章,避免 overload ambiguity 42725)。
drop function if exists public.search_rooms(text, text, integer, integer, integer, text, text[], text[], text, integer, integer);

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
           ((case when s.ad_tier <> 'free' then 1 else 0 end) + (case when rt.kind = 'whole' then 1 else 0 end)) as prio
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
      case when p_sort='default' then prio end desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      prio desc, featured desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$function$;
