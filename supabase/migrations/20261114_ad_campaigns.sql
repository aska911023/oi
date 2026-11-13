-- 活動廣告輪播(付費方案):業者上傳廣告 → 送審 → admin 核准 → 該地區詳情頁中間輪播
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,  -- 廣告主(業者);平台自建可 null
  title text not null,
  image text not null,                 -- 廣告圖(封面)
  link_url text,                       -- 點擊前往(選填)
  region text not null default 'all',  -- 'all' 或 縣市名(分地區投放)
  tier text not null default 'free',   -- 方案(plans.key)
  start_date date,                     -- 檔期(null=不限)
  end_date date,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  sort int not null default 0,         -- 同地區多筆的排序
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists ad_campaigns_live_idx on public.ad_campaigns (region, status) where status='approved';

alter table public.ad_campaigns enable row level security;
-- 核准的公開可讀(輪播要撈);業者看自己的;admin 全權
drop policy if exists ad_sel_public on public.ad_campaigns;
create policy ad_sel_public on public.ad_campaigns for select using (status='approved' or owner_id = auth.uid() or public.is_admin());
drop policy if exists ad_ins_own on public.ad_campaigns;
create policy ad_ins_own on public.ad_campaigns for insert with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists ad_upd_own on public.ad_campaigns;
create policy ad_upd_own on public.ad_campaigns for update using (public.is_admin() or owner_id = auth.uid()) with check (public.is_admin() or owner_id = auth.uid());
drop policy if exists ad_del_own on public.ad_campaigns;
create policy ad_del_own on public.ad_campaigns for delete using (public.is_admin() or owner_id = auth.uid());

-- 守門:非 admin 一律鎖成「待審核 + 自己名下」,任何編輯都重新送審(跟民宿上架一致)
create or replace function public.guard_ad_campaign() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  new.owner_id := auth.uid();
  new.status := 'pending';
  new.reject_reason := null;
  return new;
end $fn$;
drop trigger if exists trg_guard_ad_campaign on public.ad_campaigns;
create trigger trg_guard_ad_campaign before insert or update on public.ad_campaigns
  for each row execute function public.guard_ad_campaign();
