-- ============================================================
-- 偶宿 O! — Supabase Schema（貼到 Supabase → SQL Editor → Run）
-- 順序:擴充 → 資料表 → 函式 → 觸發器 → RLS。可重複執行（idempotent）。
-- ============================================================

create extension if not exists pgcrypto;

-- ────────────────────────────── 資料表 ──────────────────────────────

-- profiles（對應 auth.users）
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  full_name     text,
  phone         text,
  role          text not null default 'user' check (role in ('user','partner','admin')),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
-- 若表已存在,補欄位
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists address text;

-- stays（民宿）
create table if not exists public.stays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region      text not null,
  town        text not null,
  category    text not null check (category in ('海景度假','山林小屋','設計旅宿','親子友善','寵物友善','包棟民宿')),
  price       integer not null default 2000 check (price >= 0 and price <= 1000000),
  guests      integer not null default 2 check (guests >= 1 and guests <= 100),
  image       text not null default '',
  description text not null default '',
  amenities   text not null default '',
  website     text not null default '',
  published   boolean not null default false,
  sample      boolean not null default false,
  featured    boolean not null default false,
  visibility  text not null default 'published' check (visibility in ('published','draft','archived')),
  owner_id    uuid references public.profiles(id) on delete set null,
  origin      text not null default 'custom',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists stays_region_idx    on public.stays(region);
create index if not exists stays_category_idx  on public.stays(category);
create index if not exists stays_published_idx on public.stays(published, visibility);
create index if not exists stays_owner_idx     on public.stays(owner_id);
alter table public.stays add column if not exists rooms_left integer; -- 剩餘房數(null=不顯示)

-- vendors（業者）
create table if not exists public.vendors (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  phone         text,
  status        text not null default 'active' check (status in ('active','suspended')),
  created_at    timestamptz not null default now()
);
-- 業者完整聯絡/官方資訊(核准時由申請資料帶入)
alter table public.vendors add column if not exists address     text;
alter table public.vendors add column if not exists email       text;
alter table public.vendors add column if not exists website     text;
alter table public.vendors add column if not exists line_url    text;
alter table public.vendors add column if not exists fb_url      text;
alter table public.vendors add column if not exists license_url text;

-- vendor_applications（業者申請 → admin 審核）
create table if not exists public.vendor_applications (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  note          text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles(id) on delete set null
);
-- 業者註冊資訊(店名已有 business_name):地址/電話/email/官網/LINE/FB/營業執照
alter table public.vendor_applications add column if not exists address     text;
alter table public.vendor_applications add column if not exists phone       text;
alter table public.vendor_applications add column if not exists email       text;
alter table public.vendor_applications add column if not exists website     text;
alter table public.vendor_applications add column if not exists line_url    text;
alter table public.vendor_applications add column if not exists fb_url      text;
alter table public.vendor_applications add column if not exists license_url text;

-- sponsorships（置頂版位）
create table if not exists public.sponsorships (
  id         uuid primary key default gen_random_uuid(),
  stay_id    uuid not null references public.stays(id) on delete cascade,
  slot       text not null default 'featured',
  starts_at  date not null default current_date,
  ends_at    date,
  status     text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now()
);

-- saved（收藏）
create table if not exists public.saved (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  stay_id    uuid not null references public.stays(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, stay_id)
);

-- track_events（曝光/點擊/導流）
create table if not exists public.track_events (
  id         bigint generated always as identity primary key,
  stay_id    uuid references public.stays(id) on delete cascade,
  kind       text not null check (kind in ('impression','click','outbound')),
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists track_stay_idx on public.track_events(stay_id, kind, created_at);

-- ────────────────────────────── 函式 ──────────────────────────────

-- 角色判斷（SECURITY DEFINER,避免 RLS 遞迴）
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- 新用戶自動建立 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, full_name, phone, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- 禁止非 admin 自行改 role
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 只擋「登入中的一般會員」偷改 role;server 端(service_role / SQL Editor,auth.uid() 為 NULL)與 admin 放行
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end; $$;

-- 自動更新 updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ────────────────────────────── 觸發器 ──────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles for each row execute function public.guard_profile_role();

drop trigger if exists trg_stays_touch on public.stays;
create trigger trg_stays_touch
  before update on public.stays for each row execute function public.touch_updated_at();

-- ────────────────────────────── RLS ──────────────────────────────

alter table public.profiles            enable row level security;
alter table public.stays               enable row level security;
alter table public.vendors             enable row level security;
alter table public.vendor_applications enable row level security;
alter table public.sponsorships        enable row level security;
alter table public.saved               enable row level security;
alter table public.track_events        enable row level security;

drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists stays_public_sel on public.stays;
create policy stays_public_sel on public.stays for select
  using ((published = true and visibility = 'published') or owner_id = auth.uid() or public.is_admin());
drop policy if exists stays_ins on public.stays;
create policy stays_ins on public.stays for insert with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists stays_upd on public.stays;
create policy stays_upd on public.stays for update using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists stays_del on public.stays;
create policy stays_del on public.stays for delete using (public.is_admin() or owner_id = auth.uid());

drop policy if exists vendors_sel on public.vendors;
create policy vendors_sel on public.vendors for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists vendors_admin on public.vendors;
create policy vendors_admin on public.vendors for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists va_ins on public.vendor_applications;
create policy va_ins on public.vendor_applications for insert with check (applicant_id = auth.uid());
drop policy if exists va_sel on public.vendor_applications;
create policy va_sel on public.vendor_applications for select using (applicant_id = auth.uid() or public.is_admin());
drop policy if exists va_upd on public.vendor_applications;
create policy va_upd on public.vendor_applications for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists sp_sel on public.sponsorships;
create policy sp_sel on public.sponsorships for select using (true);
drop policy if exists sp_manage on public.sponsorships;
create policy sp_manage on public.sponsorships for all
  using (public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));

drop policy if exists saved_all on public.saved;
create policy saved_all on public.saved for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists track_ins on public.track_events;
create policy track_ins on public.track_events for insert with check (true);
drop policy if exists track_sel on public.track_events;
create policy track_sel on public.track_events for select
  using (public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));

-- ── site_settings（首頁/外觀設定,單列 id=1） ──
create table if not exists public.site_settings (
  id             int primary key default 1,
  hero_eyebrow   text,
  hero_title     text,
  hero_subtitle  text,
  hero_caption   text,
  search_hint    text,
  hero_image     text,
  color_primary  text,
  color_accent   text,
  heading_font   text,
  hero_title_size int,
  updated_at     timestamptz not null default now(),
  constraint site_settings_single check (id = 1)
);
alter table public.site_settings add column if not exists hero_styles jsonb;
alter table public.site_settings add column if not exists hero_images jsonb;
alter table public.site_settings add column if not exists bg_color text;
alter table public.site_settings add column if not exists blocks jsonb;
alter table public.site_settings add column if not exists hero_layout text;
alter table public.site_settings add column if not exists hero_split_ratio int;
alter table public.site_settings add column if not exists logo_image text;
alter table public.site_settings add column if not exists logo_size int;
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
alter table public.site_settings enable row level security;
drop policy if exists site_sel on public.site_settings;
create policy site_sel on public.site_settings for select using (true);
drop policy if exists site_upd on public.site_settings;
create policy site_upd on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- ── Storage：site bucket（首頁圖片上傳,公開讀、admin 寫） ──
insert into storage.buckets (id, name, public) values ('site','site',true) on conflict (id) do nothing;
drop policy if exists site_obj_read on storage.objects;
create policy site_obj_read on storage.objects for select using (bucket_id = 'site');
drop policy if exists site_obj_write on storage.objects;
create policy site_obj_write on storage.objects for insert with check (bucket_id = 'site' and public.is_admin());
drop policy if exists site_obj_update on storage.objects;
create policy site_obj_update on storage.objects for update using (bucket_id = 'site' and public.is_admin());
drop policy if exists site_obj_delete on storage.objects;
create policy site_obj_delete on storage.objects for delete using (bucket_id = 'site' and public.is_admin());

-- ── Storage：vendor-docs bucket（營業執照等敏感文件,私有;本人上傳、本人/admin 讀） ──
insert into storage.buckets (id, name, public) values ('vendor-docs','vendor-docs',false) on conflict (id) do nothing;
-- 路徑規則:<uid>/檔名 → 只能上傳到自己的資料夾
drop policy if exists vdoc_insert on storage.objects;
create policy vdoc_insert on storage.objects for insert
  with check (bucket_id = 'vendor-docs' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists vdoc_select on storage.objects;
create policy vdoc_select on storage.objects for select
  using (bucket_id = 'vendor-docs' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
drop policy if exists vdoc_delete on storage.objects;
create policy vdoc_delete on storage.objects for delete
  using (bucket_id = 'vendor-docs' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));

-- ── pois（二級分類:探索景點 attraction / 探索美食 food / 停車區域 parking） ──
create table if not exists public.pois (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('attraction','food','parking')),
  name        text not null,
  region      text not null,
  town        text not null default '',
  address     text not null default '',
  description text not null default '',
  image       text not null default '',
  website     text not null default '',
  lat         double precision,
  lng         double precision,
  published   boolean not null default true,
  featured    boolean not null default false,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pois_kind_idx   on public.pois(kind, published);
create index if not exists pois_region_idx on public.pois(region);
drop trigger if exists trg_pois_touch on public.pois;
create trigger trg_pois_touch before update on public.pois for each row execute function public.touch_updated_at();
alter table public.pois enable row level security;
drop policy if exists pois_sel on public.pois;
create policy pois_sel on public.pois for select using (published = true or public.is_admin() or owner_id = auth.uid());
drop policy if exists pois_ins on public.pois;
create policy pois_ins on public.pois for insert with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists pois_upd on public.pois;
create policy pois_upd on public.pois for update using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists pois_del on public.pois;
create policy pois_del on public.pois for delete using (public.is_admin() or owner_id = auth.uid());

-- ── trips（⑤行程規劃 + ⑥分享平台共用） ──
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles(id) on delete set null,
  title       text not null default '我的行程',
  days        int not null default 2 check (days between 1 and 30),
  headcount   int not null default 2 check (headcount between 1 and 99),
  budget      int,
  transport   text,
  region      text,
  summary     text,
  items       jsonb not null default '[]'::jsonb,
  is_public   boolean not null default false,
  share_slug  text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists trips_owner_idx  on public.trips(owner_id);
create index if not exists trips_public_idx on public.trips(is_public, created_at);
create index if not exists trips_region_idx on public.trips(region);
drop trigger if exists trg_trips_touch on public.trips;
create trigger trg_trips_touch before update on public.trips for each row execute function public.touch_updated_at();
alter table public.trips enable row level security;
drop policy if exists trips_sel on public.trips;
create policy trips_sel on public.trips for select using (is_public = true or owner_id = auth.uid() or public.is_admin());
drop policy if exists trips_ins on public.trips;
create policy trips_ins on public.trips for insert with check (owner_id = auth.uid());
drop policy if exists trips_upd on public.trips;
create policy trips_upd on public.trips for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists trips_del on public.trips;
create policy trips_del on public.trips for delete using (owner_id = auth.uid() or public.is_admin());

-- ── 分頁搜尋 RPC(只回當頁 + 總數;invoker 走 RLS。資料一多也只抓 24 筆) ──
create or replace function public.search_stays(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_sort text default 'default',
  lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select * from public.stays s
    where s.published and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or s.price >= p_price_min)
      and (p_price_max is null or s.price <= p_price_max)
      and (p_guests is null or s.guests >= p_guests)
      and (coalesce(kw,'') = '' or
           (coalesce(s.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (
    select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      created_at desc
    limit greatest(lim,0) offset greatest(off,0)
  )
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_stays(text,text,int,int,int,text,text,int,int) to anon, authenticated;

create or replace function public.search_pois(
  p_kind text, kw text default '', p_region text default null, lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select * from public.pois p
    where p.published and p.kind = p_kind
      and (p_region is null or p.region = p_region)
      and (coalesce(kw,'') = '' or
           (coalesce(p.name,'')||' '||coalesce(p.region,'')||' '||coalesce(p.town,'')||' '||coalesce(p.address,'')||' '||coalesce(p.description,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last, created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_pois(text,text,text,int,int) to anon, authenticated;

create or replace function public.search_trips(
  kw text default '', p_days_min int default null, p_days_max int default null,
  p_budget_max int default null, p_head_min int default null, p_head_max int default null,
  p_transport text default null, p_region text default null, lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select * from public.trips t
    where t.is_public
      and (p_days_min is null or t.days >= p_days_min)
      and (p_days_max is null or t.days <= p_days_max)
      and (p_budget_max is null or (t.budget is not null and t.budget <= p_budget_max))
      and (p_head_min is null or t.headcount >= p_head_min)
      and (p_head_max is null or t.headcount <= p_head_max)
      and (p_transport is null or t.transport = p_transport)
      and (p_region is null or t.region = p_region)
      and (coalesce(kw,'') = '' or (coalesce(t.title,'')||' '||coalesce(t.summary,'')||' '||coalesce(t.region,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_trips(text,int,int,int,int,int,text,text,int,int) to anon, authenticated;

-- ── 第二層:房型 / 租車(店+方案)/ 景點·美食·停車獨立表 ──
-- ================= 家族 A:場所 + 方案/庫存 =================

-- 民宿房型
create table if not exists public.room_types (
  id          uuid primary key default gen_random_uuid(),
  stay_id     uuid not null references public.stays(id) on delete cascade,
  name        text not null,
  price       integer not null default 0,
  capacity    integer not null default 2,
  rooms_total integer,
  rooms_left  integer,
  beds        text,
  amenities   text not null default '',
  image       text not null default '',
  description text not null default '',
  sort        integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists room_types_stay_idx on public.room_types(stay_id);
drop trigger if exists trg_room_types_touch on public.room_types;
create trigger trg_room_types_touch before update on public.room_types for each row execute function public.touch_updated_at();
alter table public.room_types enable row level security;
drop policy if exists rt_sel on public.room_types;
create policy rt_sel on public.room_types for select using (
  public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id
    and ((s.published and s.visibility='published') or s.owner_id = auth.uid())));
drop policy if exists rt_manage on public.room_types;
create policy rt_manage on public.room_types for all using (
  public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));

-- 租車店
create table if not exists public.rental_shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region      text not null,
  town        text not null default '',
  address     text not null default '',
  phone       text,
  image       text not null default '',
  description text not null default '',
  website     text not null default '',
  line_url    text,
  lat         double precision,
  lng         double precision,
  published   boolean not null default false,
  featured    boolean not null default false,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rental_shops_region_idx on public.rental_shops(region);
create index if not exists rental_shops_pub_idx on public.rental_shops(published);
drop trigger if exists trg_rental_shops_touch on public.rental_shops;
create trigger trg_rental_shops_touch before update on public.rental_shops for each row execute function public.touch_updated_at();
alter table public.rental_shops enable row level security;
drop policy if exists rs_sel on public.rental_shops;
create policy rs_sel on public.rental_shops for select using (published = true or public.is_admin() or owner_id = auth.uid());
drop policy if exists rs_ins on public.rental_shops;
create policy rs_ins on public.rental_shops for insert with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists rs_upd on public.rental_shops;
create policy rs_upd on public.rental_shops for update using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists rs_del on public.rental_shops;
create policy rs_del on public.rental_shops for delete using (public.is_admin() or owner_id = auth.uid());

-- 租車方案
create table if not exists public.rental_plans (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.rental_shops(id) on delete cascade,
  name          text not null,
  price_per_day integer not null default 0,
  deposit       integer,
  includes      text not null default '',
  count_total   integer,
  count_left    integer,
  image         text not null default '',
  description   text not null default '',
  sort          integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rental_plans_shop_idx on public.rental_plans(shop_id);
drop trigger if exists trg_rental_plans_touch on public.rental_plans;
create trigger trg_rental_plans_touch before update on public.rental_plans for each row execute function public.touch_updated_at();
alter table public.rental_plans enable row level security;
drop policy if exists rp_sel on public.rental_plans;
create policy rp_sel on public.rental_plans for select using (
  public.is_admin() or exists (select 1 from public.rental_shops s where s.id = shop_id
    and (s.published or s.owner_id = auth.uid())));
drop policy if exists rp_manage on public.rental_plans;
create policy rp_manage on public.rental_plans for all using (
  public.is_admin() or exists (select 1 from public.rental_shops s where s.id = shop_id and s.owner_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.rental_shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- ================= 家族 B:場所 + 資訊(details jsonb) =================
do $$
declare t text;
begin
  foreach t in array array['attractions','restaurants','parking_lots'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id          uuid primary key default gen_random_uuid(),
        name        text not null,
        region      text not null,
        town        text not null default '',
        address     text not null default '',
        image       text not null default '',
        description text not null default '',
        website     text not null default '',
        lat         double precision,
        lng         double precision,
        details     jsonb not null default '{}'::jsonb,
        published   boolean not null default true,
        featured    boolean not null default false,
        owner_id    uuid references public.profiles(id) on delete set null,
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now()
      );
      create index if not exists %1$s_region_idx on public.%1$I(region);
      create index if not exists %1$s_pub_idx on public.%1$I(published);
      drop trigger if exists trg_%1$s_touch on public.%1$I;
      create trigger trg_%1$s_touch before update on public.%1$I for each row execute function public.touch_updated_at();
      alter table public.%1$I enable row level security;
      drop policy if exists %1$s_sel on public.%1$I;
      create policy %1$s_sel on public.%1$I for select using (published = true or public.is_admin() or owner_id = auth.uid());
      drop policy if exists %1$s_ins on public.%1$I;
      create policy %1$s_ins on public.%1$I for insert with check (public.is_admin() or owner_id = auth.uid());
      drop policy if exists %1$s_upd on public.%1$I;
      create policy %1$s_upd on public.%1$I for update using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
      drop policy if exists %1$s_del on public.%1$I;
      create policy %1$s_del on public.%1$I for delete using (public.is_admin() or owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ================= 改 search_stays:起價/剩餘/人數 自動吃房型(無房型則沿用民宿欄位) =================
drop function if exists public.search_stays(text,text,int,int,int,text,text,int,int);
create or replace function public.search_stays(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_sort text default 'default',
  lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with agg as (
    select rt.stay_id,
           min(rt.price) filter (where rt.published) as mn,
           sum(rt.rooms_left) filter (where rt.published) as sm,
           max(rt.capacity) filter (where rt.published) as mx
    from public.room_types rt group by rt.stay_id
  ),
  base as (
    select s.id, s.name, s.region, s.town, s.category,
           coalesce(a.mn, s.price) as price,
           coalesce(a.mx, s.guests) as guests,
           s.image, s.description, s.amenities, s.website,
           coalesce(a.sm, s.rooms_left) as rooms_left,
           s.published, s.sample, s.featured, s.created_at
    from public.stays s left join agg a on a.stay_id = s.id
    where s.published and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or coalesce(a.mn, s.price) >= p_price_min)
      and (p_price_max is null or coalesce(a.mn, s.price) <= p_price_max)
      and (p_guests is null or coalesce(a.mx, s.guests) >= p_guests)
      and (coalesce(kw,'') = '' or
           (coalesce(s.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (
    select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      created_at desc
    limit greatest(lim,0) offset greatest(off,0)
  )
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_stays(text,text,int,int,int,text,text,int,int) to anon, authenticated;

-- ================= 租車分頁搜尋(起價=最低日租、剩餘=方案加總) =================
create or replace function public.search_rentals(
  kw text default '', p_region text default null, p_price_max int default null, lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with agg as (
    select p.shop_id, min(p.price_per_day) filter (where p.published) as mn, sum(p.count_left) filter (where p.published) as sm
    from public.rental_plans p group by p.shop_id
  ),
  base as (
    select rs.id, rs.name, rs.region, rs.town, rs.address, rs.phone, rs.image, rs.description, rs.website, rs.line_url,
           rs.lat, rs.lng, rs.featured, rs.created_at,
           coalesce(a.mn,0) as price_from, coalesce(a.sm,0) as units_left
    from public.rental_shops rs left join agg a on a.shop_id = rs.id
    where rs.published
      and (p_region is null or rs.region = p_region)
      and (p_price_max is null or coalesce(a.mn,0) <= p_price_max)
      and (coalesce(kw,'') = '' or (coalesce(rs.name,'')||' '||coalesce(rs.region,'')||' '||coalesce(rs.town,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last, created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rentals(text,text,int,int,int) to anon, authenticated;

-- ── stations(高鐵 + 台鐵車站,參考資料) ──
create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hsr','tra')),
  name text not null, region text not null default '',
  lat double precision, lng double precision, sort integer not null default 0
);
alter table public.stations enable row level security;
drop policy if exists stations_sel on public.stations;
create policy stations_sel on public.stations for select using (true);
drop policy if exists stations_admin on public.stations;
create policy stations_admin on public.stations for all using (public.is_admin()) with check (public.is_admin());

-- ── pois 已退役(景點/美食/停車改用 attractions/restaurants/parking_lots 三張獨立表) ──
drop function if exists public.search_pois(text,text,text,int,int);
drop table if exists public.pois cascade;

-- ── 房型商品化:featured + search_rooms(前台首頁改吃房型) ──
-- 房型改成前台商品:加 featured(置頂)
alter table public.room_types add column if not exists featured boolean not null default false;
create index if not exists room_types_pub_idx on public.room_types(published, featured);

-- 房型卡分頁搜尋(房型為主,帶民宿 context)。只回已發布房型 + 已上架民宿。
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_sort text default 'default',
  lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.beds, rt.description as room_desc,
           coalesce(nullif(rt.image, ''), s.image) as image, rt.featured,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc,
           rt.created_at
    from public.room_types rt
    join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (coalesce(kw,'') = '' or
           (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (
    select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      created_at desc
    limit greatest(lim,0) offset greatest(off,0)
  )
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text,int,int) to anon, authenticated;

-- ── 上架審核(approved) + 民宿地址/座標;search_rooms/search_rentals 要求 approved ──
-- 上架審核 + 民宿地址/座標
alter table public.stays        add column if not exists approved boolean not null default false;
alter table public.stays        add column if not exists address  text not null default '';
alter table public.stays        add column if not exists lat      double precision;
alter table public.stays        add column if not exists lng      double precision;
alter table public.rental_shops add column if not exists approved boolean not null default false;

-- 既有資料視為已核准,避免改版後全部消失
update public.stays        set approved = true where approved = false;
update public.rental_shops set approved = true where approved = false;

-- search_rooms:加 s.approved
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_sort text default 'default',
  lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.beds, rt.description as room_desc,
           coalesce(nullif(rt.image, ''), s.image) as image, rt.featured,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc,
           rt.created_at
    from public.room_types rt
    join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (coalesce(kw,'') = '' or
           (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (
    select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      created_at desc
    limit greatest(lim,0) offset greatest(off,0)
  )
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text,int,int) to anon, authenticated;

-- search_rentals:加 rs.approved
create or replace function public.search_rentals(
  kw text default '', p_region text default null, p_price_max int default null, lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with agg as (
    select p.shop_id, min(p.price_per_day) filter (where p.published) as mn, sum(p.count_left) filter (where p.published) as sm
    from public.rental_plans p group by p.shop_id
  ),
  base as (
    select rs.id, rs.name, rs.region, rs.town, rs.address, rs.phone, rs.image, rs.description, rs.website, rs.line_url,
           rs.lat, rs.lng, rs.featured, rs.created_at,
           coalesce(a.mn,0) as price_from, coalesce(a.sm,0) as units_left
    from public.rental_shops rs left join agg a on a.shop_id = rs.id
    where rs.published and rs.approved
      and (p_region is null or rs.region = p_region)
      and (p_price_max is null or coalesce(a.mn,0) <= p_price_max)
      and (coalesce(kw,'') = '' or (coalesce(rs.name,'')||' '||coalesce(rs.region,'')||' '||coalesce(rs.town,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last, created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rentals(text,text,int,int,int) to anon, authenticated;

-- ── reviews(民宿評價,一人一店一則) ──
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stay_id, user_id)
);
create index if not exists reviews_stay_idx on public.reviews(stay_id);
drop trigger if exists trg_reviews_touch on public.reviews;
create trigger trg_reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();
alter table public.reviews enable row level security;
drop policy if exists reviews_sel on public.reviews;
create policy reviews_sel on public.reviews for select using (true);
drop policy if exists reviews_ins on public.reviews;
create policy reviews_ins on public.reviews for insert with check (user_id = auth.uid());
drop policy if exists reviews_upd on public.reviews;
create policy reviews_upd on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reviews_del on public.reviews;
create policy reviews_del on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

alter table public.trips add column if not exists nights int not null default 1;

-- ============================================================
-- 完成。設定 admin(擇一):
--   update public.profiles set role='admin' where id = (select id from auth.users where email='你的email');
-- ============================================================
