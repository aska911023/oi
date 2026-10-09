-- ============================================================
-- P1:景點/餐廳/停車場 乾淨網址 slug
-- 新網址:/{縣市}/attraction|restaurant|parking/{slug}
-- 比照 stays.slug 作法:slug 由 trigger 自動產生(重名加 -n),查詢先 slug 後 uuid。
-- slug 只在 INSERT 時產生(保持穩定,SEO 不因更新而變);現有列用下方回填。
-- 冪等:add column if not exists / create or replace / if not exists index。
-- ============================================================

alter table public.attractions  add column if not exists slug text;
alter table public.restaurants  add column if not exists slug text;
alter table public.parking_lots add column if not exists slug text;

create unique index if not exists attractions_slug_uidx  on public.attractions(slug);
create unique index if not exists restaurants_slug_uidx  on public.restaurants(slug);
create unique index if not exists parking_lots_slug_uidx on public.parking_lots(slug);

-- 泛用 slug trigger:用 TG_TABLE_NAME 動態查該表唯一性(三表共用)
create or replace function public.tg_place_slug() returns trigger
language plpgsql security definer set search_path=public as $$
declare base text; cand text; n int := 1; clash int;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := coalesce(nullif(public.make_slug(coalesce(new.region,'')||'-'||coalesce(new.name,'')),''), new.id::text);
  cand := base;
  loop
    execute format('select 1 from public.%I where slug=$1 and id<>$2 limit 1', TG_TABLE_NAME)
      into clash using cand, new.id;
    exit when clash is null;
    n := n + 1; cand := base || '-' || n;
  end loop;
  new.slug := cand; return new;
end; $$;

drop trigger if exists trg_attractions_slug  on public.attractions;
drop trigger if exists trg_restaurants_slug  on public.restaurants;
drop trigger if exists trg_parking_lots_slug on public.parking_lots;
create trigger trg_attractions_slug  before insert on public.attractions  for each row execute function public.tg_place_slug();
create trigger trg_restaurants_slug  before insert on public.restaurants  for each row execute function public.tg_place_slug();
create trigger trg_parking_lots_slug before insert on public.parking_lots for each row execute function public.tg_place_slug();

-- 回填現有列(partition 去重:同 base 第 2 筆起加 -n)
with ranked as (
  select id,
    coalesce(nullif(public.make_slug(coalesce(region,'')||'-'||coalesce(name,'')),''), id::text) as base,
    row_number() over (partition by coalesce(nullif(public.make_slug(coalesce(region,'')||'-'||coalesce(name,'')),''), id::text) order by id) as rn
  from public.attractions where slug is null or slug = ''
) update public.attractions a set slug = case when r.rn=1 then r.base else r.base||'-'||r.rn end from ranked r where a.id=r.id;

with ranked as (
  select id,
    coalesce(nullif(public.make_slug(coalesce(region,'')||'-'||coalesce(name,'')),''), id::text) as base,
    row_number() over (partition by coalesce(nullif(public.make_slug(coalesce(region,'')||'-'||coalesce(name,'')),''), id::text) order by id) as rn
  from public.restaurants where slug is null or slug = ''
) update public.restaurants a set slug = case when r.rn=1 then r.base else r.base||'-'||r.rn end from ranked r where a.id=r.id;

with ranked as (
  select id,
    coalesce(nullif(public.make_slug(coalesce(region,'')||'-'||coalesce(name,'')),''), id::text) as base,
    row_number() over (partition by coalesce(nullif(public.make_slug(coalesce(region,'')||'-'||coalesce(name,'')),''), id::text) order by id) as rn
  from public.parking_lots where slug is null or slug = ''
) update public.parking_lots a set slug = case when r.rn=1 then r.base else r.base||'-'||r.rn end from ranked r where a.id=r.id;
