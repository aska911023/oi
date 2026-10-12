-- 有照片優先:新增生成欄 has_image(布林)+ search_rooms 排序改成「有照片排前面」
-- 不下架任何資料,只改排序 → 有圖的優先出現、沒圖的沉到後面,SEO 不受傷
alter table public.stays        add column if not exists has_image boolean generated always as (coalesce(image,'')<>'' or coalesce(array_length(images,1),0)>0) stored;
alter table public.attractions  add column if not exists has_image boolean generated always as (coalesce(image,'')<>'' or coalesce(array_length(images,1),0)>0) stored;
alter table public.restaurants  add column if not exists has_image boolean generated always as (coalesce(image,'')<>'' or coalesce(array_length(images,1),0)>0) stored;
alter table public.parking_lots add column if not exists has_image boolean generated always as (coalesce(image,'')<>'' or coalesce(array_length(images,1),0)>0) stored;
alter table public.rental_shops add column if not exists has_image boolean generated always as (coalesce(image,'')<>'') stored;

-- search_rooms:簽章不變,只在 base 加 has_image,並把 has_image desc 放到排序最前
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
      has_image desc,
      case when p_sort='default' then prio end desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      prio desc, featured desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$function$;
