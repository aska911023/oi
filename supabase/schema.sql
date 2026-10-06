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

-- ── 收藏行程 + search_trips 帶發布者名稱 ──
-- 收藏別人的行程
create table if not exists public.saved_trips (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  trip_id    uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.saved_trips enable row level security;
drop policy if exists saved_trips_all on public.saved_trips;
create policy saved_trips_all on public.saved_trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- search_trips 加回傳發布者名稱 owner_name
create or replace function public.search_trips(
  kw text default '', p_days_min int default null, p_days_max int default null,
  p_budget_max int default null, p_head_min int default null, p_head_max int default null,
  p_transport text default null, p_region text default null, lim int default 24, off int default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select t.*, (select p.display_name from public.profiles p where p.id = t.owner_id) as owner_name
    from public.trips t
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

-- ── search_rooms 加 p_amenities(民宿設施前台篩選) ──
drop function if exists public.search_rooms(text,text,int,int,int,text,text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_sort text default 'default',
  lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.beds, rt.description as room_desc,
           coalesce(nullif(rt.image, ''), s.image) as image, rt.featured,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text,int,int) to anon, authenticated;

-- ── 租車車種標籤 + 房型標籤 + 篩選(p_tags / p_room_tags) ──
alter table public.rental_shops add column if not exists tags text[];
alter table public.room_types  add column if not exists tags text[];

-- search_rentals + p_tags(車種/品牌)
drop function if exists public.search_rentals(text,text,int,int,int);
create or replace function public.search_rentals(
  kw text default '', p_region text default null, p_price_max int default null, p_tags text[] default null, lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with agg as (
    select p.shop_id, min(p.price_per_day) filter (where p.published) as mn, sum(p.count_left) filter (where p.published) as sm
    from public.rental_plans p group by p.shop_id
  ),
  base as (
    select rs.id, rs.name, rs.region, rs.town, rs.address, rs.phone, rs.image, rs.description, rs.website, rs.line_url,
           rs.lat, rs.lng, rs.featured, rs.tags, rs.created_at,
           coalesce(a.mn,0) as price_from, coalesce(a.sm,0) as units_left
    from public.rental_shops rs left join agg a on a.shop_id = rs.id
    where rs.published and rs.approved
      and (p_region is null or rs.region = p_region)
      and (p_price_max is null or coalesce(a.mn,0) <= p_price_max)
      and (p_tags is null or rs.tags @> p_tags)
      and (coalesce(kw,'') = '' or (coalesce(rs.name,'')||' '||coalesce(rs.region,'')||' '||coalesce(rs.town,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last, created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rentals(text,text,int,text[],int,int) to anon, authenticated;

-- search_rooms + p_room_tags(房型標籤:有浴缸/有陽台…)
drop function if exists public.search_rooms(text,text,int,int,int,text,text[],text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_room_tags text[] default null,
  p_sort text default 'default', lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image, rt.featured,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (p_room_tags is null or rt.tags @> p_room_tags)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int) to anon, authenticated;

alter table public.site_settings add column if not exists contact_email text;
alter table public.site_settings add column if not exists contact_line text;
alter table public.site_settings add column if not exists contact_phone text;

alter table public.site_settings add column if not exists footer_about text;
alter table public.site_settings add column if not exists footer_copyright text;
alter table public.site_settings add column if not exists footer_tagline text;

alter table public.site_settings add column if not exists about_body text;
alter table public.site_settings add column if not exists contact_intro text;

-- ── 行程社群:按讚 / 留言 + search_trips 帶讚數留言數 ──
-- 行程按讚
create table if not exists public.trip_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.trip_likes enable row level security;
drop policy if exists trip_likes_sel on public.trip_likes;
create policy trip_likes_sel on public.trip_likes for select using (true);
drop policy if exists trip_likes_own on public.trip_likes;
create policy trip_likes_own on public.trip_likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 行程留言
create table if not exists public.trip_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists trip_comments_trip_idx on public.trip_comments(trip_id, created_at);
alter table public.trip_comments enable row level security;
drop policy if exists trip_comments_sel on public.trip_comments;
create policy trip_comments_sel on public.trip_comments for select using (true);
drop policy if exists trip_comments_ins on public.trip_comments;
create policy trip_comments_ins on public.trip_comments for insert with check (user_id = auth.uid());
drop policy if exists trip_comments_del on public.trip_comments;
create policy trip_comments_del on public.trip_comments for delete using (user_id = auth.uid() or public.is_admin());

-- 留言者名稱(定義者:繞 RLS 只取 display_name)
create or replace function public.trip_comments_list(p_trip uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'body', c.body, 'created_at', c.created_at,
    'name', (select display_name from public.profiles p where p.id = c.user_id)
  ) order by c.created_at desc), '[]'::jsonb)
  from public.trip_comments c where c.trip_id = p_trip;
$$;
grant execute on function public.trip_comments_list(uuid) to anon, authenticated;

-- search_trips 帶讚數/留言數
create or replace function public.search_trips(
  kw text default '', p_days_min int default null, p_days_max int default null,
  p_budget_max int default null, p_head_min int default null, p_head_max int default null,
  p_transport text default null, p_region text default null, lim int default 24, off int default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select t.*,
      (select p.display_name from public.profiles p where p.id = t.owner_id) as owner_name,
      (select count(*) from public.trip_likes l where l.trip_id = t.id) as like_count,
      (select count(*) from public.trip_comments c where c.trip_id = t.id) as comment_count
    from public.trips t
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

-- ================= 多張圖片:stays + room_types 相簿(封面/房型可上傳多張,前台輪播) =================
alter table public.stays add column if not exists images text[] not null default '{}';
alter table public.room_types add column if not exists images text[] not null default '{}';

-- search_stays:回傳 images(封面相簿;空則退回單張 image)
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
           s.image,
           coalesce(nullif(s.images,'{}'), array_remove(array[nullif(s.image,'')], null)) as images,
           s.description, s.amenities, s.website,
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

-- search_rooms:回傳 images(房型相簿;空則退回民宿相簿/單張封面)
drop function if exists public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_room_tags text[] default null,
  p_sort text default 'default', lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image,
           coalesce(nullif(rt.images,'{}'), nullif(s.images,'{}'),
                    array_remove(array[nullif(rt.image,''), nullif(s.image,'')], null)) as images,
           rt.featured,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (p_room_tags is null or rt.tags @> p_room_tags)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int) to anon, authenticated;

-- ================= 房型 包棟/單間 + 分時期價格 + 包含房間;住宿入住/退房時間 =================
alter table public.room_types add column if not exists kind text not null default 'single';   -- 'single'(獨立單間) | 'whole'(包棟)
alter table public.room_types add column if not exists pricing jsonb not null default '{}';    -- {weekday,peak_weekday,minor_holiday,holiday,rack,extra_weekday,extra_holiday}
alter table public.room_types add column if not exists includes_note text;                     -- 包棟包含哪些房間(自由文字)
alter table public.stays add column if not exists check_in text;    -- 最早入住(例 15:00)
alter table public.stays add column if not exists check_out text;   -- 最晚退房(例 11:00)

-- ================= 景點/美食/停車:收藏 + 留言牆(kind+place_id 定位) =================
create table if not exists public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  place_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, place_id)
);
alter table public.saved_places enable row level security;
drop policy if exists sp_own on public.saved_places;
create policy sp_own on public.saved_places for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_saved_places_user on public.saved_places(user_id);

create table if not exists public.place_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  place_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.place_comments enable row level security;
drop policy if exists pc_read on public.place_comments;
create policy pc_read on public.place_comments for select using (true);
drop policy if exists pc_insert on public.place_comments;
create policy pc_insert on public.place_comments for insert with check (auth.uid() = user_id);
drop policy if exists pc_delete on public.place_comments;
create policy pc_delete on public.place_comments for delete using (auth.uid() = user_id);
create index if not exists idx_place_comments on public.place_comments(kind, place_id, created_at desc);

create or replace function public.place_comments_list(p_kind text, p_id uuid)
returns table(id uuid, body text, created_at timestamptz, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, pr.display_name as name
  from public.place_comments c
  left join public.profiles pr on pr.id = c.user_id
  where c.kind = p_kind and c.place_id = p_id
  order by c.created_at desc
$$;
grant execute on function public.place_comments_list(text, uuid) to anon, authenticated;

-- ================= 景點/美食/停車:多張圖片相簿 =================
alter table public.attractions   add column if not exists images text[] not null default '{}';
alter table public.restaurants   add column if not exists images text[] not null default '{}';
alter table public.parking_lots  add column if not exists images text[] not null default '{}';

-- ================= 合法民宿編號 + search_rooms 回傳 rooms_total(前台顯示「共 N 間」) =================
alter table public.stays add column if not exists license_no text;
drop function if exists public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_room_tags text[] default null,
  p_sort text default 'default', lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.rooms_total, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image,
           coalesce(nullif(rt.images,'{}'), nullif(s.images,'{}'),
                    array_remove(array[nullif(rt.image,''), nullif(s.image,'')], null)) as images,
           rt.featured,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (p_room_tags is null or rt.tags @> p_room_tags)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by featured desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int) to anon, authenticated;

-- ================= 事件埋點(分析):瀏覽 / 導流點擊 / 地圖 … =================
create table if not exists public.events (
  id bigint generated always as identity primary key,
  type text not null,
  stay_id uuid,
  room_id uuid,
  user_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create index if not exists idx_events_type_time on public.events(type, created_at desc);
create index if not exists idx_events_stay on public.events(stay_id, created_at desc);

create or replace function public.log_event(p_type text, p_stay uuid default null, p_room uuid default null, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type is null or length(p_type) > 40 then return; end if;
  insert into public.events(type, stay_id, room_id, user_id, meta)
  values (p_type, p_stay, p_room, auth.uid(), coalesce(p_meta, '{}'::jsonb));
end $$;
grant execute on function public.log_event(text, uuid, uuid, jsonb) to anon, authenticated;

create or replace function public.stay_event_stats(p_stay uuid, p_days int default 30)
returns table(type text, cnt bigint) language sql stable security definer set search_path = public as $$
  select e.type, count(*)::bigint from public.events e
  where e.stay_id = p_stay and e.created_at >= now() - (p_days || ' days')::interval
    and (
      exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
      or exists (select 1 from public.stays s where s.id = p_stay and s.owner_id = auth.uid())
    )
  group by e.type
$$;
grant execute on function public.stay_event_stats(uuid, int) to authenticated;

-- ================= 廣告分級(曝光方案 free/featured/flagship):search 預設排序付費置頂 =================
alter table public.stays add column if not exists ad_tier text not null default 'free';
update public.stays set ad_tier = 'featured' where ad_tier = 'free' and featured = true;

drop function if exists public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_room_tags text[] default null,
  p_sort text default 'default', lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.rooms_total, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image,
           coalesce(nullif(rt.images,'{}'), nullif(s.images,'{}'),
                    array_remove(array[nullif(rt.image,''), nullif(s.image,'')], null)) as images,
           rt.featured, s.ad_tier,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at,
           case s.ad_tier when 'flagship' then 2 when 'featured' then 1 else 0 end as tier_rank
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (p_room_tags is null or rt.tags @> p_room_tags)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by
      case when p_sort='default' then tier_rank end desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      tier_rank desc, featured desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int) to anon, authenticated;

drop function if exists public.search_stays(text,text,int,int,int,text,text,int,int);
create or replace function public.search_stays(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_sort text default 'default',
  lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with agg as (
    select rt.stay_id, min(rt.price) filter (where rt.published) as mn,
           sum(rt.rooms_left) filter (where rt.published) as sm, max(rt.capacity) filter (where rt.published) as mx
    from public.room_types rt group by rt.stay_id
  ),
  base as (
    select s.id, s.name, s.region, s.town, s.category,
           coalesce(a.mn, s.price) as price, coalesce(a.mx, s.guests) as guests,
           s.image, coalesce(nullif(s.images,'{}'), array_remove(array[nullif(s.image,'')], null)) as images,
           s.description, s.amenities, s.website, coalesce(a.sm, s.rooms_left) as rooms_left,
           s.published, s.sample, s.featured, s.ad_tier, s.created_at,
           case s.ad_tier when 'flagship' then 2 when 'featured' then 1 else 0 end as tier_rank
    from public.stays s left join agg a on a.stay_id = s.id
    where s.published and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or coalesce(a.mn, s.price) >= p_price_min)
      and (p_price_max is null or coalesce(a.mn, s.price) <= p_price_max)
      and (p_guests is null or coalesce(a.mx, s.guests) >= p_guests)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by
      case when p_sort='default' then tier_rank end desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      tier_rank desc, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_stays(text,text,int,int,int,text,text,int,int) to anon, authenticated;

-- ================= 收藏社群證明:save_count(實際收藏+save_boost)=================
alter table public.stays add column if not exists save_boost int not null default 0;
drop function if exists public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_room_tags text[] default null,
  p_sort text default 'default', lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.rooms_total, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image,
           coalesce(nullif(rt.images,'{}'), nullif(s.images,'{}'),
                    array_remove(array[nullif(rt.image,''), nullif(s.image,'')], null)) as images,
           rt.featured, s.ad_tier,
           ((select count(*) from public.saved_places sp where sp.kind = 'room' and sp.place_id = rt.id) + coalesce(s.save_boost, 0))::int as save_count,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at,
           case s.ad_tier when 'flagship' then 2 when 'featured' then 1 else 0 end as tier_rank
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
      and (p_category is null or s.category = p_category)
      and (p_price_min is null or rt.price >= p_price_min)
      and (p_price_max is null or rt.price <= p_price_max)
      and (p_guests is null or rt.capacity >= p_guests)
      and (p_amenities is null or (select bool_and(s.amenities ilike '%'||a||'%') from unnest(p_amenities) a))
      and (p_room_tags is null or rt.tags @> p_room_tags)
      and (coalesce(kw,'') = '' or (coalesce(s.name,'')||' '||coalesce(rt.name,'')||' '||coalesce(s.region,'')||' '||coalesce(s.town,'')||' '||coalesce(s.amenities,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by
      case when p_sort='default' then tier_rank end desc nulls last,
      case when p_sort='low' then price end asc nulls last,
      case when p_sort='high' then price end desc nulls last,
      tier_rank desc, featured desc nulls last, created_at desc
    limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int) to anon, authenticated;

-- ================= 旗艦收掉(付費之後再做);卡片顯示「包棟」標 + 曝光優先=精選+包棟 =================
update public.stays set ad_tier = 'featured' where ad_tier = 'flagship';
drop function if exists public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int);
create or replace function public.search_rooms(
  kw text default '', p_region text default null, p_price_min int default null, p_price_max int default null,
  p_guests int default null, p_category text default null, p_amenities text[] default null, p_room_tags text[] default null,
  p_sort text default 'default', lim int default 24, off int default 0
) returns jsonb language sql stable as $$
  with base as (
    select rt.id, rt.name as room_name, rt.price, rt.capacity, rt.rooms_left, rt.rooms_total, rt.kind, rt.beds, rt.description as room_desc, rt.tags,
           coalesce(nullif(rt.image, ''), s.image) as image,
           coalesce(nullif(rt.images,'{}'), nullif(s.images,'{}'),
                    array_remove(array[nullif(rt.image,''), nullif(s.image,'')], null)) as images,
           rt.featured, s.ad_tier,
           ((select count(*) from public.saved_places sp where sp.kind = 'room' and sp.place_id = rt.id) + coalesce(s.save_boost, 0))::int as save_count,
           s.id as stay_id, s.name as stay_name, s.region, s.town, s.category, s.amenities, s.website, s.description as stay_desc, rt.created_at,
           ((case when s.ad_tier <> 'free' then 1 else 0 end) + (case when rt.kind = 'whole' then 1 else 0 end)) as prio
    from public.room_types rt join public.stays s on s.id = rt.stay_id
    where rt.published and s.published and s.approved and s.visibility = 'published'
      and (p_region is null or s.region = p_region)
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
$$;
grant execute on function public.search_rooms(text,text,int,int,int,text,text[],text[],text,int,int) to anon, authenticated;

-- ================= 行程通知鈴鐺(Threads 式)+ 分享/收藏計數 =================
alter table public.trips add column if not exists share_count int not null default 0;

create or replace function public.bump_trip_share(p_trip uuid)
returns void language sql security definer set search_path = public as $$
  update public.trips set share_count = share_count + 1 where id = p_trip and is_public;
$$;
grant execute on function public.bump_trip_share(uuid) to anon, authenticated;

drop function if exists public.search_trips(text,int,int,int,int,int,text,text,int,int);
create or replace function public.search_trips(
  kw text default '', p_days_min int default null, p_days_max int default null,
  p_budget_max int default null, p_head_min int default null, p_head_max int default null,
  p_transport text default null, p_region text default null, lim int default 24, off int default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select t.*,
      (select p.display_name from public.profiles p where p.id = t.owner_id) as owner_name,
      (select count(*) from public.trip_likes l where l.trip_id = t.id) as like_count,
      (select count(*) from public.trip_comments c where c.trip_id = t.id) as comment_count,
      (select count(*) from public.saved_trips sv where sv.trip_id = t.id) as save_count,
      t.share_count
    from public.trips t
    where t.is_public
      and (p_days_min is null or t.days >= p_days_min) and (p_days_max is null or t.days <= p_days_max)
      and (p_budget_max is null or (t.budget is not null and t.budget <= p_budget_max))
      and (p_head_min is null or t.headcount >= p_head_min) and (p_head_max is null or t.headcount <= p_head_max)
      and (p_transport is null or t.transport = p_transport) and (p_region is null or t.region = p_region)
      and (coalesce(kw,'') = '' or (coalesce(t.title,'')||' '||coalesce(t.summary,'')||' '||coalesce(t.region,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_trips(text,int,int,int,int,int,text,text,int,int) to anon, authenticated;

create or replace function public.my_notifications(lim int default 30)
returns table(kind text, trip_id uuid, trip_title text, actor text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'like'::text as kind, t.id as trip_id, t.title as trip_title, coalesce(pr.display_name,'旅人') as actor, l.created_at
    from public.trip_likes l join public.trips t on t.id=l.trip_id and t.owner_id=auth.uid()
    left join public.profiles pr on pr.id=l.user_id where l.user_id <> auth.uid()
    union all
    select 'comment', t.id, t.title, coalesce(pr.display_name,'旅人'), c.created_at
    from public.trip_comments c join public.trips t on t.id=c.trip_id and t.owner_id=auth.uid()
    left join public.profiles pr on pr.id=c.user_id where c.user_id <> auth.uid()
    union all
    select 'save', t.id, t.title, coalesce(pr.display_name,'旅人'), sv.created_at
    from public.saved_trips sv join public.trips t on t.id=sv.trip_id and t.owner_id=auth.uid()
    left join public.profiles pr on pr.id=sv.user_id where sv.user_id <> auth.uid()
  ) x order by 5 desc limit greatest(lim,0);
$$;
grant execute on function public.my_notifications(int) to authenticated;

-- ================= 個人公開行程(點頭像看某人分享的行程)=================
create or replace function public.user_public_trips(p_uid uuid, lim int default 24, off int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select t.*,
      (select p.display_name from public.profiles p where p.id = t.owner_id) as owner_name,
      (select count(*) from public.trip_likes l where l.trip_id = t.id) as like_count,
      (select count(*) from public.trip_comments c where c.trip_id = t.id) as comment_count,
      (select count(*) from public.saved_trips sv where sv.trip_id = t.id) as save_count,
      t.share_count
    from public.trips t
    where t.is_public and t.owner_id = p_uid
  ),
  page as (select * from base order by created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object(
    'name', (select display_name from public.profiles where id = p_uid),
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb)
  );
$$;
grant execute on function public.user_public_trips(uuid, int, int) to anon, authenticated;

-- ================= 頭貼(avatar) + 社群 RPC 帶頭貼 =================
alter table public.profiles add column if not exists avatar_url text;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop function if exists public.search_trips(text,int,int,int,int,int,text,text,int,int);
create or replace function public.search_trips(
  kw text default '', p_days_min int default null, p_days_max int default null,
  p_budget_max int default null, p_head_min int default null, p_head_max int default null,
  p_transport text default null, p_region text default null, lim int default 24, off int default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select t.*,
      (select p.display_name from public.profiles p where p.id = t.owner_id) as owner_name,
      (select p.avatar_url from public.profiles p where p.id = t.owner_id) as owner_avatar,
      (select count(*) from public.trip_likes l where l.trip_id = t.id) as like_count,
      (select count(*) from public.trip_comments c where c.trip_id = t.id) as comment_count,
      (select count(*) from public.saved_trips sv where sv.trip_id = t.id) as save_count,
      t.share_count
    from public.trips t
    where t.is_public
      and (p_days_min is null or t.days >= p_days_min) and (p_days_max is null or t.days <= p_days_max)
      and (p_budget_max is null or (t.budget is not null and t.budget <= p_budget_max))
      and (p_head_min is null or t.headcount >= p_head_min) and (p_head_max is null or t.headcount <= p_head_max)
      and (p_transport is null or t.transport = p_transport) and (p_region is null or t.region = p_region)
      and (coalesce(kw,'') = '' or (coalesce(t.title,'')||' '||coalesce(t.summary,'')||' '||coalesce(t.region,'')) ilike '%'||kw||'%')
  ),
  page as (select * from base order by created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object('total',(select count(*) from base),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
grant execute on function public.search_trips(text,int,int,int,int,int,text,text,int,int) to anon, authenticated;

create or replace function public.user_public_trips(p_uid uuid, lim int default 24, off int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select t.*,
      (select p.display_name from public.profiles p where p.id = t.owner_id) as owner_name,
      (select p.avatar_url from public.profiles p where p.id = t.owner_id) as owner_avatar,
      (select count(*) from public.trip_likes l where l.trip_id = t.id) as like_count,
      (select count(*) from public.trip_comments c where c.trip_id = t.id) as comment_count,
      (select count(*) from public.saved_trips sv where sv.trip_id = t.id) as save_count,
      t.share_count
    from public.trips t where t.is_public and t.owner_id = p_uid
  ),
  page as (select * from base order by created_at desc limit greatest(lim,0) offset greatest(off,0))
  select jsonb_build_object(
    'name', (select display_name from public.profiles where id = p_uid),
    'avatar', (select avatar_url from public.profiles where id = p_uid),
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb));
$$;
grant execute on function public.user_public_trips(uuid, int, int) to anon, authenticated;

drop function if exists public.my_notifications(int);
create or replace function public.my_notifications(lim int default 30)
returns table(kind text, trip_id uuid, trip_title text, actor text, actor_avatar text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'like'::text as kind, t.id as trip_id, t.title as trip_title, coalesce(pr.display_name,'旅人') as actor, pr.avatar_url as actor_avatar, l.created_at
    from public.trip_likes l join public.trips t on t.id=l.trip_id and t.owner_id=auth.uid()
    left join public.profiles pr on pr.id=l.user_id where l.user_id <> auth.uid()
    union all
    select 'comment', t.id, t.title, coalesce(pr.display_name,'旅人'), pr.avatar_url, c.created_at
    from public.trip_comments c join public.trips t on t.id=c.trip_id and t.owner_id=auth.uid()
    left join public.profiles pr on pr.id=c.user_id where c.user_id <> auth.uid()
    union all
    select 'save', t.id, t.title, coalesce(pr.display_name,'旅人'), pr.avatar_url, sv.created_at
    from public.saved_trips sv join public.trips t on t.id=sv.trip_id and t.owner_id=auth.uid()
    left join public.profiles pr on pr.id=sv.user_id where sv.user_id <> auth.uid()
  ) x order by 6 desc limit greatest(lim,0);
$$;
grant execute on function public.my_notifications(int) to authenticated;

-- ================= YouTube / IG 影片嵌入(上架民宿 + 分享行程)=================
alter table public.stays add column if not exists embed_url text;
alter table public.trips add column if not exists embed_url text;

-- ============================================================
-- 完成。設定 admin(擇一):
--   update public.profiles set role='admin' where id = (select id from auth.users where email='你的email');
-- ============================================================


-- ============================================================
-- 開發名單 leads：內部 BD 用。候選民宿／景點，尚未洽談、尚未取得圖文授權。
-- 刻意與 stays/attractions 分離，避免未授權資料混進上架資料被誤發布。
-- ============================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'stay',
  code text,                       -- 來源編號 NB01 / V01
  name text not null,
  county text,                     -- 花蓮縣 / 新北市 / 宜蘭縣
  area text,                       -- 子區域：北海岸 / 東北角
  town text,                       -- 鄉鎮：金山 / 九份 / 五結
  address text,
  category text,                   -- 景點用：景點/博物館/夜市/溫泉/特色活動
  theme text,                      -- 主題或活動子項
  priority text,                   -- A 優先洽談 / B 補資料
  status text not null default '候選',
  guests_min int,
  guests_max int,
  guests_ambiguous boolean not null default false,  -- 人數只有單一數字，待人工確認
  price_from int,                  -- 解析出的最低參考價（元／棟／晚）
  price_note text,                 -- 價格原文
  room_note text,
  whole_house text,
  parking text,
  phone text,
  line_id text,
  website text,
  license_no text,                 -- 民宿登記號線索
  summary text,                    -- 包棟人數・參考價・選店理由
  contact_note text,               -- 聯絡方式・地址・查核提醒 原文
  description text,                -- 介紹草稿
  open_note text,                  -- 景點：開放提醒／查核狀態
  photo_status text,               -- 照片商用授權狀態
  photo_urls text[] not null default '{}',
  source_doc text,                 -- 來源名單
  checked_on date,                 -- 名單查核日
  owner_note text,                 -- 人工後續備註
  contacted_at timestamptz,
  stay_id uuid references public.stays(id) on delete set null,  -- 談成後連到正式上架資料
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_kind_chk') then
    alter table public.leads add constraint leads_kind_chk
      check (kind in ('stay', 'attraction'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_priority_chk') then
    alter table public.leads add constraint leads_priority_chk
      check (priority is null or priority in ('A', 'B'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_status_chk') then
    alter table public.leads add constraint leads_status_chk
      check (status in ('候選', '已聯絡', '洽談中', '已簽約', '婉拒', '暫不處理'));
  end if;
end $$;

-- 同一份名單同一家只會有一筆 → 重跑匯入是冪等的
create unique index if not exists leads_source_name_uidx on public.leads (source_doc, name);
create index if not exists leads_kind_idx     on public.leads (kind);
create index if not exists leads_county_idx   on public.leads (county);
create index if not exists leads_priority_idx on public.leads (priority);
create index if not exists leads_status_idx   on public.leads (status);

create or replace function public.tg_leads_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_leads_touch on public.leads;
create trigger trg_leads_touch before update on public.leads
  for each row execute function public.tg_leads_touch();

-- RLS：內部資料，只有 admin 看得到、改得動
alter table public.leads enable row level security;
drop policy if exists leads_admin_all on public.leads;
create policy leads_admin_all on public.leads
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.leads from anon;
grant select, insert, update, delete on public.leads to authenticated;


-- ============================================================
-- stay_bd：民宿洽談紀錄（已聯繫 / 拒絕 / 備註）
-- ★ 刻意不放在 stays：stays 的 SELECT policy 是「published 就人人可讀」,
--   備註寫在 stays 會被公開 API 讀到。這張表只有 admin 讀得到。
-- ============================================================
create table if not exists public.stay_bd (
  stay_id uuid primary key references public.stays(id) on delete cascade,
  contacted boolean not null default false,   -- 已聯繫
  rejected boolean not null default false,    -- 對方拒絕
  note text,                                  -- 內部備註
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create or replace function public.tg_stay_bd_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists trg_stay_bd_touch on public.stay_bd;
create trigger trg_stay_bd_touch before insert or update on public.stay_bd
  for each row execute function public.tg_stay_bd_touch();

alter table public.stay_bd enable row level security;
drop policy if exists stay_bd_admin_all on public.stay_bd;
create policy stay_bd_admin_all on public.stay_bd
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.stay_bd from anon;
grant select, insert, update, delete on public.stay_bd to authenticated;


-- ============================================================
-- stay_snapshots：民宿資料快照
-- 交給業者自行管理前先存一份,日後對方改壞/改掉都還原得回來,也能比對他們改了什麼。
-- ============================================================
create table if not exists public.stay_snapshots (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  stay jsonb not null,            -- 當下的 stays 整列
  room_types jsonb not null default '[]'::jsonb,  -- 當下的所有房型
  reason text,                    -- 例:轉移給業者前備份
  owner_before uuid,
  owner_after uuid,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists stay_snapshots_stay_idx on public.stay_snapshots (stay_id, created_at desc);

create or replace function public.tg_stay_snapshot_stamp()
returns trigger language plpgsql as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

drop trigger if exists trg_stay_snapshot_stamp on public.stay_snapshots;
create trigger trg_stay_snapshot_stamp before insert on public.stay_snapshots
  for each row execute function public.tg_stay_snapshot_stamp();

alter table public.stay_snapshots enable row level security;
drop policy if exists stay_snapshots_admin on public.stay_snapshots;
create policy stay_snapshots_admin on public.stay_snapshots
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.stay_snapshots from anon;
grant select, insert, update, delete on public.stay_snapshots to authenticated;

-- ------------------------------------------------------------
-- 指派業主：先存快照、再改 owner_id,兩件事在同一個交易裡完成
-- p_owner 傳 null = 收回自管
-- ------------------------------------------------------------
create or replace function public.assign_stay_owner(p_stay uuid, p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_before uuid;
  v_snap uuid;
begin
  if not public.is_admin() then
    raise exception '只有管理者可以指派業主';
  end if;

  select owner_id into v_before from public.stays where id = p_stay;
  if not found then
    raise exception '找不到這筆民宿';
  end if;

  insert into public.stay_snapshots (stay_id, stay, room_types, reason, owner_before, owner_after)
  select p_stay,
         to_jsonb(s),
         coalesce((select jsonb_agg(to_jsonb(rt)) from public.room_types rt where rt.stay_id = p_stay), '[]'::jsonb),
         case when p_owner is null then '收回自管前備份' else '轉移給業者前備份' end,
         v_before, p_owner
  from public.stays s where s.id = p_stay
  returning id into v_snap;

  update public.stays set owner_id = p_owner where id = p_stay;

  return jsonb_build_object('snapshot_id', v_snap, 'owner_before', v_before, 'owner_after', p_owner);
end $$;

revoke all on function public.assign_stay_owner(uuid, uuid) from public, anon;
grant execute on function public.assign_stay_owner(uuid, uuid) to authenticated;


-- 2026-10-06 新增民宿風格「復古老宅」(放寬 CHECK;前端 CATEGORIES/StayCategory 已同步)
alter table public.stays drop constraint if exists stays_category_check;
alter table public.stays add constraint stays_category_check
  check (category = any (array['海景度假','山林小屋','設計旅宿','親子友善','寵物友善','包棟民宿','復古老宅']));


-- ============================================================
-- 2026-10-06 修正房型卡「N 人收藏」永遠是 0
-- 原因:saved_places 有 RLS(只看得到自己的),search_rooms 是 SECURITY INVOKER,
--      首頁第一屏又用匿名 client 跑 → 內部 count(*) 被 RLS 濾成 0。
-- 做法:只把「算人數」這件事用 DEFINER 小函式繞過 RLS,其餘維持原樣。
-- ============================================================
create or replace function public.room_save_count(p_room uuid)
returns integer language sql stable security definer set search_path to 'public'
as $$
  select count(*)::int from public.saved_places sp
  where sp.kind = 'room' and sp.place_id = p_room;
$$;
revoke all on function public.room_save_count(uuid) from public;
grant execute on function public.room_save_count(uuid) to anon, authenticated;
-- search_rooms 內的 save_count 改成:
--   (public.room_save_count(rt.id) + coalesce(s.save_boost, 0))::int as save_count


-- 2026-10-06 開放資料匯入配套
alter table public.stays add column if not exists phone text;
alter table public.stays drop constraint if exists stays_category_check;
alter table public.stays add constraint stays_category_check
  check (category = any (array['海景度假','山林小屋','設計旅宿','親子友善','寵物友善','包棟民宿','復古老宅','一般民宿']));
