-- 活動專頁:時效性活動(市集/手作/展覽/親子/季節…)。總後台直接上架、業者/創作者投稿送審。
-- 註:表名用 happenings(public.events 已是分析追蹤表,不可共用)。前台路由/UI 仍叫「活動」。
create table if not exists public.happenings (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null,
  image text not null default '',
  images text[] not null default '{}',
  category text not null default '其他',
  region text not null default '',
  town text not null default '',
  address text not null default '',
  lat float8, lng float8,
  start_date date,              -- 活動起日(null=長期/不限)
  end_date date,                -- 迄日(null=單日,同 start_date)
  start_time text not null default '',
  end_time text not null default '',
  all_day boolean not null default false,
  is_free boolean not null default false,
  indoor boolean not null default false,   -- 室內/雨天備案
  description text not null default '',
  link_url text not null default '',        -- 報名/官方連結
  owner_id uuid references auth.users(id) on delete set null,
  published boolean not null default false,
  approved boolean not null default false,
  featured boolean not null default false,
  ad_tier text not null default 'free',
  ad_start date, ad_end date,
  save_boost int not null default 0,
  has_image boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists happenings_pub_idx on public.happenings (published) where published;
create index if not exists happenings_region_idx on public.happenings (region, published);
create index if not exists happenings_date_idx on public.happenings (end_date, start_date);
create index if not exists happenings_owner_idx on public.happenings (owner_id);

-- 審核守門:admin 直接(不干涉);業者/創作者投稿一律 pending、不能自封上架/精選/方案
create or replace function public.guard_happening() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if is_admin() or auth.uid() is null then return new; end if;
  if tg_op='INSERT' then
    new.owner_id := auth.uid();
    new.published := false; new.approved := false; new.featured := false;
    new.ad_tier := 'free'; new.ad_start := null; new.ad_end := null; new.save_boost := 0;
  else
    new.published := old.published; new.approved := old.approved; new.featured := old.featured;
    new.ad_tier := old.ad_tier; new.ad_start := old.ad_start; new.ad_end := old.ad_end; new.save_boost := old.save_boost;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_happenings_guard on public.happenings;
create trigger trg_happenings_guard before insert or update on public.happenings for each row execute function public.guard_happening();

-- slug(用 title;空則自動產生、撞名加號)
create or replace function public.tg_happenings_slug() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare base text; cand text; n int := 1;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := coalesce(nullif(public.make_slug(coalesce(new.title,'')),''), new.id::text);
  cand := base;
  while exists(select 1 from public.happenings where slug = cand and id <> new.id) loop
    n := n + 1; cand := base || '-' || n;
  end loop;
  new.slug := cand;
  return new;
end $fn$;
drop trigger if exists trg_happenings_slug on public.happenings;
create trigger trg_happenings_slug before insert or update on public.happenings for each row execute function public.tg_happenings_slug();

drop trigger if exists trg_happenings_touch on public.happenings;
create trigger trg_happenings_touch before update on public.happenings for each row execute function public.touch_updated_at();

-- RLS:已上架公開可讀;業者看自己的;admin 全權
alter table public.happenings enable row level security;
drop policy if exists happenings_sel on public.happenings;
create policy happenings_sel on public.happenings for select using (published or owner_id = auth.uid() or public.is_admin());
drop policy if exists happenings_ins on public.happenings;
create policy happenings_ins on public.happenings for insert with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists happenings_upd on public.happenings;
create policy happenings_upd on public.happenings for update using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists happenings_del on public.happenings;
create policy happenings_del on public.happenings for delete using (public.is_admin() or owner_id = auth.uid());
