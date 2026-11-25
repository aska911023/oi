-- 真·附近推薦:DB 端依「與目前地點的距離」排序(有經緯度的先、近的先,其餘用最新),不受資料量限制。
-- 取代原本「同縣市 .limit(N) 取最舊 N 筆」(資料變多也不變、根本沒算距離)。
CREATE OR REPLACE FUNCTION public.nearby_pois(p_region text, p_lat float8, p_lng float8, p_exclude uuid, p_limit int default 6)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select jsonb_build_object(
    'hotels', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by dist asc nulls last, created_at desc), '[]'::jsonb)
      from (select id,name,slug,created_at,(case when p_lat is null or lat is null then null else (lat-p_lat)^2+(lng-p_lng)^2 end) dist
            from public.stays where published and approved and visibility='published' and region=p_region and id is distinct from p_exclude
            order by dist asc nulls last, created_at desc limit p_limit) a),
    'attractions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by dist asc nulls last, created_at desc), '[]'::jsonb)
      from (select id,name,slug,created_at,(case when p_lat is null or lat is null then null else (lat-p_lat)^2+(lng-p_lng)^2 end) dist
            from public.attractions where published and region=p_region and id is distinct from p_exclude
            order by dist asc nulls last, created_at desc limit p_limit) a),
    'restaurants', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by dist asc nulls last, created_at desc), '[]'::jsonb)
      from (select id,name,slug,created_at,(case when p_lat is null or lat is null then null else (lat-p_lat)^2+(lng-p_lng)^2 end) dist
            from public.restaurants where published and region=p_region and id is distinct from p_exclude
            order by dist asc nulls last, created_at desc limit p_limit) a),
    'parking', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by dist asc nulls last, created_at desc), '[]'::jsonb)
      from (select id,name,slug,created_at,(case when p_lat is null or lat is null then null else (lat-p_lat)^2+(lng-p_lng)^2 end) dist
            from public.parking_lots where published and region=p_region and id is distinct from p_exclude
            order by dist asc nulls last, created_at desc limit p_limit) a),
    'rentals', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by dist asc nulls last, created_at desc), '[]'::jsonb)
      from (select id,name,created_at,(case when p_lat is null or lat is null then null else (lat-p_lat)^2+(lng-p_lng)^2 end) dist
            from public.rental_shops where published and approved and region=p_region and id is distinct from p_exclude
            order by dist asc nulls last, created_at desc limit p_limit) a),
    'happenings', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',title,'slug',slug) order by dist asc nulls last, start_date asc nulls last), '[]'::jsonb)
      from (select id,title,slug,start_date,(case when p_lat is null or lat is null then null else (lat-p_lat)^2+(lng-p_lng)^2 end) dist
            from public.happenings where published and approved and region=p_region
              and (coalesce(end_date,start_date) is null or coalesce(end_date,start_date) >= current_date)
            order by dist asc nulls last, start_date asc nulls last limit p_limit) a)
  );
$$;
REVOKE ALL ON FUNCTION public.nearby_pois(text, float8, float8, uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.nearby_pois(text, float8, float8, uuid, int) TO anon, authenticated;
