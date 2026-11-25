-- 民宿活動專欄(每間民宿自己的活動 / 專案 / 加購,顯示在詳情頁;之後併入付費方案)
create table if not exists public.stay_promos (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  title text not null,
  subtitle text,
  image text,
  link_url text,
  price_note text,          -- 例:加購 $500/人、兩人同行 8 折
  badge text,               -- 例:限時、熱銷、新活動
  start_date date,
  end_date date,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stay_promos_stay_idx on public.stay_promos(stay_id, sort);

drop trigger if exists stay_promos_touch on public.stay_promos;
create trigger stay_promos_touch before update on public.stay_promos
  for each row execute function public.touch_updated_at();

alter table public.stay_promos enable row level security;

-- 公開讀「已上架」;admin 一律可讀(後台含草稿)
drop policy if exists stay_promos_read on public.stay_promos;
create policy stay_promos_read on public.stay_promos for select
  using (published = true or public.is_admin());

-- admin 全權
drop policy if exists stay_promos_admin on public.stay_promos;
create policy stay_promos_admin on public.stay_promos for all
  using (public.is_admin()) with check (public.is_admin());

-- 該民宿業主可管自己這間的活動(機制先備好;業者後台入口之後綁付費方案才開放)
drop policy if exists stay_promos_owner on public.stay_promos;
create policy stay_promos_owner on public.stay_promos for all
  using (exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));
