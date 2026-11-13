-- 餐廳/娛樂/外燴 管理功能比照民宿:曝光方案(ad_tier)+ 授權期間 + 收藏墊高 + 審核(approved)
-- 洽談/內部備註另存 place_bd(只有 admin 讀寫,不經公開 API)
alter table public.restaurants add column if not exists ad_tier text not null default 'free';
alter table public.restaurants add column if not exists ad_start date;
alter table public.restaurants add column if not exists ad_end date;
alter table public.restaurants add column if not exists save_boost int not null default 0;
alter table public.restaurants add column if not exists approved boolean not null default true;

alter table public.activities add column if not exists ad_tier text not null default 'free';
alter table public.activities add column if not exists ad_start date;
alter table public.activities add column if not exists ad_end date;
alter table public.activities add column if not exists save_boost int not null default 0;
alter table public.activities add column if not exists approved boolean not null default true;

alter table public.caterings add column if not exists ad_tier text not null default 'free';
alter table public.caterings add column if not exists ad_start date;
alter table public.caterings add column if not exists ad_end date;
alter table public.caterings add column if not exists save_boost int not null default 0;
alter table public.caterings add column if not exists approved boolean not null default true;

-- 洽談紀錄(contacted/rejected/內部備註):kind+place_id 為鍵,只有 admin 能存取
create table if not exists public.place_bd (
  kind text not null,
  place_id uuid not null,
  contacted boolean not null default false,
  rejected boolean not null default false,
  note text,
  updated_at timestamptz default now(),
  updated_by uuid,
  primary key (kind, place_id)
);
alter table public.place_bd enable row level security;
drop policy if exists place_bd_admin on public.place_bd;
create policy place_bd_admin on public.place_bd for all using (public.is_admin()) with check (public.is_admin());
