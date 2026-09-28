-- ============================================================
-- 偶宿 O! — Supabase Schema（貼到 Supabase → SQL Editor → Run）
-- 含資料表、觸發器與 RLS。可重複執行（idempotent）。
-- ============================================================

-- 需要 gen_random_uuid()
create extension if not exists pgcrypto;

-- ── 角色判斷 helper（SECURITY DEFINER，避免 RLS 遞迴） ──
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- ── profiles（對應 auth.users） ──
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone        text,
  role         text not null default 'user' check (role in ('user','partner','admin')),
  created_at   timestamptz not null default now(),
  last_login_at timestamptz
);

-- 新用戶自動建立 profile（第一個帳號或 OUSU_ADMIN 由 app 端升級為 admin）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 禁止非 admin 自行改 role
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role; -- 悄悄擋回,不報錯
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles for each row execute function public.guard_profile_role();

-- ── stays（民宿） ──
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
  featured    boolean not null default false,   -- 贊助置頂
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

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_stays_touch on public.stays;
create trigger trg_stays_touch before update on public.stays for each row execute function public.touch_updated_at();

-- ── vendors（業者） ──
create table if not exists public.vendors (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  phone         text,
  status        text not null default 'active' check (status in ('active','suspended')),
  created_at    timestamptz not null default now()
);

-- ── vendor_applications（業者申請 → admin 審核） ──
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

-- ── sponsorships（置頂版位） ──
create table if not exists public.sponsorships (
  id         uuid primary key default gen_random_uuid(),
  stay_id    uuid not null references public.stays(id) on delete cascade,
  slot       text not null default 'featured',
  starts_at  date not null default current_date,
  ends_at    date,
  status     text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now()
);

-- ── saved（收藏） ──
create table if not exists public.saved (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  stay_id    uuid not null references public.stays(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, stay_id)
);

-- ── track_events（曝光/點擊/導流） ──
create table if not exists public.track_events (
  id         bigint generated always as identity primary key,
  stay_id    uuid references public.stays(id) on delete cascade,
  kind       text not null check (kind in ('impression','click','outbound')),
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists track_stay_idx on public.track_events(stay_id, kind, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.stays               enable row level security;
alter table public.vendors             enable row level security;
alter table public.vendor_applications enable row level security;
alter table public.sponsorships        enable row level security;
alter table public.saved               enable row level security;
alter table public.track_events        enable row level security;

-- profiles：本人或 admin 可讀;本人可改(role 由觸發器守門)
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- stays：公開只看已上架;owner 看自己;admin 全看。寫入 owner 或 admin。
drop policy if exists stays_public_sel on public.stays;
create policy stays_public_sel on public.stays for select
  using ((published = true and visibility = 'published') or owner_id = auth.uid() or public.is_admin());
drop policy if exists stays_ins on public.stays;
create policy stays_ins on public.stays for insert
  with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists stays_upd on public.stays;
create policy stays_upd on public.stays for update
  using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists stays_del on public.stays;
create policy stays_del on public.stays for delete
  using (public.is_admin() or owner_id = auth.uid());

-- vendors：本人或 admin 讀;admin 管
drop policy if exists vendors_sel on public.vendors;
create policy vendors_sel on public.vendors for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists vendors_admin on public.vendors;
create policy vendors_admin on public.vendors for all using (public.is_admin()) with check (public.is_admin());

-- vendor_applications：本人建/看自己;admin 全看+審核
drop policy if exists va_ins on public.vendor_applications;
create policy va_ins on public.vendor_applications for insert with check (applicant_id = auth.uid());
drop policy if exists va_sel on public.vendor_applications;
create policy va_sel on public.vendor_applications for select using (applicant_id = auth.uid() or public.is_admin());
drop policy if exists va_upd on public.vendor_applications;
create policy va_upd on public.vendor_applications for update using (public.is_admin()) with check (public.is_admin());

-- sponsorships：公開可讀(前台判斷置頂);admin 或 stay owner 管
drop policy if exists sp_sel on public.sponsorships;
create policy sp_sel on public.sponsorships for select using (true);
drop policy if exists sp_manage on public.sponsorships;
create policy sp_manage on public.sponsorships for all
  using (public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));

-- saved：只有本人
drop policy if exists saved_all on public.saved;
create policy saved_all on public.saved for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- track_events：任何人可寫入(含匿名訪客);只有 admin 或 stay owner 可讀
drop policy if exists track_ins on public.track_events;
create policy track_ins on public.track_events for insert with check (true);
drop policy if exists track_sel on public.track_events;
create policy track_sel on public.track_events for select
  using (public.is_admin() or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));

-- ============================================================
-- 完成。之後把某帳號設為 admin：
--   update public.profiles set role='admin' where id = (select id from auth.users where email='you@example.com');
-- ============================================================
