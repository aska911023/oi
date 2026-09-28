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

-- vendors（業者）
create table if not exists public.vendors (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  phone         text,
  status        text not null default 'active' check (status in ('active','suspended')),
  created_at    timestamptz not null default now()
);

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

-- ============================================================
-- 完成。設定 admin(擇一):
--   update public.profiles set role='admin' where id = (select id from auth.users where email='你的email');
-- ============================================================
