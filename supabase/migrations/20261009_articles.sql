-- ============================================================
-- 旅遊攻略 / 懶人包 內容系統(articles)
-- 公開頁 /guides、/guides/{slug};後台 CRUD;只收錄 published。
-- ============================================================
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  excerpt text,
  cover_image text,
  body text,                 -- Markdown
  region text,               -- 關聯城市(選填,城市頁可帶出)
  tag text,                  -- 類型:城市指南 / 一日遊 / 兩天一夜 / 親子 / 季節…
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_published_idx on public.articles(published, created_at desc);
create index if not exists articles_region_idx on public.articles(region);

-- slug 自動產生(重名加 -n;沿用 make_slug)
create or replace function public.tg_articles_slug() returns trigger
language plpgsql security definer set search_path=public as $$
declare base text; cand text; n int := 1;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := coalesce(nullif(public.make_slug(coalesce(new.title,'')),''), new.id::text);
  cand := base;
  while exists(select 1 from public.articles where slug=cand and id<>new.id) loop n:=n+1; cand:=base||'-'||n; end loop;
  new.slug := cand; return new;
end; $$;
drop trigger if exists trg_articles_slug on public.articles;
create trigger trg_articles_slug before insert on public.articles for each row execute function public.tg_articles_slug();

-- updated_at 自動更新
create or replace function public.tg_articles_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_articles_touch on public.articles;
create trigger trg_articles_touch before update on public.articles for each row execute function public.tg_articles_touch();

-- RLS:公開讀已發布;admin 全權
alter table public.articles enable row level security;
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select using (published = true or public.is_admin());
drop policy if exists articles_admin_all on public.articles;
create policy articles_admin_all on public.articles for all using (public.is_admin()) with check (public.is_admin());
