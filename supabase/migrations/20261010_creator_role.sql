-- ============================================================
-- 創作者(creator)角色 — 地基
-- 1. profiles.role 允許 'creator'
-- 2. articles 加 author_id(作者)+ 創作者可管自己的 RLS
-- 3. 創作者申請表 creator_applications
-- 4. is_creator() helper
-- ============================================================

-- 1. role CHECK 加 creator(先找出舊 check 名字再換)
do $$
declare cn text;
begin
  select c.conname into cn from pg_constraint c join pg_class t on t.oid=c.conrelid
    where t.relname='profiles' and c.contype='c' and pg_get_constraintdef(c.oid) ilike '%role%';
  if cn is not null then execute format('alter table public.profiles drop constraint %I', cn); end if;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['user'::text, 'partner'::text, 'admin'::text, 'creator'::text]));

-- helper:目前登入者是否為創作者(或 admin)
create or replace function public.is_creator() returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator','admin'));
$$;

-- 2. articles 作者
alter table public.articles add column if not exists author_id uuid references public.profiles(id) on delete set null;
create index if not exists articles_author_idx on public.articles(author_id);

-- articles RLS:公開讀 published;admin 全權;創作者管「自己的」
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select
  using (published = true or public.is_admin() or author_id = auth.uid());
drop policy if exists articles_admin_all on public.articles;
create policy articles_admin_all on public.articles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists articles_creator_ins on public.articles;
create policy articles_creator_ins on public.articles for insert with check (public.is_creator() and author_id = auth.uid());
drop policy if exists articles_creator_upd on public.articles;
create policy articles_creator_upd on public.articles for update using (author_id = auth.uid() and public.is_creator()) with check (author_id = auth.uid());
drop policy if exists articles_creator_del on public.articles;
create policy articles_creator_del on public.articles for delete using (author_id = auth.uid() and public.is_creator());

-- 3. 創作者申請表
create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  intro text,                 -- 自我介紹 / 想產什麼內容
  links text,                 -- IG / YT / 作品連結
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (applicant_id)
);
alter table public.creator_applications enable row level security;
drop policy if exists ca_ins on public.creator_applications;
create policy ca_ins on public.creator_applications for insert with check (applicant_id = auth.uid());
drop policy if exists ca_sel on public.creator_applications;
create policy ca_sel on public.creator_applications for select using (applicant_id = auth.uid() or public.is_admin());
drop policy if exists ca_admin on public.creator_applications;
create policy ca_admin on public.creator_applications for all using (public.is_admin()) with check (public.is_admin());
