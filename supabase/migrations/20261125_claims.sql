-- 業者認領:認領「已收錄但沒業主」的店家。免費;人工審核;核准即指派 owner_id + 升為業者。
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- stay/restaurant/activity/catering/attraction/parking/rental/happening
  target_id uuid not null,
  target_name text not null default '',
  applicant_id uuid not null references auth.users(id) on delete cascade,
  applicant_role text not null default 'owner',   -- owner/manager/agent/employee
  auth_until date,                    -- 授權期間
  contact text not null default '',   -- 可供獨立核對的官方聯繫(電話/信箱)
  relation_note text not null default '',
  wish_note text not null default '', -- 希望更正或新增
  material_note text not null default '',
  want_paid boolean not null default false,  -- 是否另詢問付費合作
  status text not null default 'pending' check (status in ('pending','verifying','need_docs','approved','rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists claims_status_idx on public.claims (status);
create index if not exists claims_applicant_idx on public.claims (applicant_id);
create index if not exists claims_target_idx on public.claims (kind, target_id);

drop trigger if exists trg_claims_touch on public.claims;
create trigger trg_claims_touch before update on public.claims for each row execute function public.touch_updated_at();

alter table public.claims enable row level security;
drop policy if exists claims_sel on public.claims;
create policy claims_sel on public.claims for select using (applicant_id = auth.uid() or public.is_admin());
drop policy if exists claims_ins on public.claims;
create policy claims_ins on public.claims for insert with check (applicant_id = auth.uid());
drop policy if exists claims_upd on public.claims;
create policy claims_upd on public.claims for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists claims_del on public.claims;
create policy claims_del on public.claims for delete using (applicant_id = auth.uid() or public.is_admin());

-- 核准:指派 owner_id 給申請人 + 若是一般會員升為業者 + 發通知
create or replace function public.claim_approve(p_claim uuid) returns text
language plpgsql security definer set search_path to 'public' as $fn$
declare c record; tbl text;
begin
  if not public.is_admin() then raise exception '只有管理員可核准認領'; end if;
  select * into c from public.claims where id = p_claim;
  if not found then raise exception '找不到這筆認領申請'; end if;
  tbl := case c.kind
    when 'stay' then 'stays' when 'restaurant' then 'restaurants' when 'activity' then 'activities'
    when 'catering' then 'caterings' when 'attraction' then 'attractions' when 'parking' then 'parking_lots'
    when 'rental' then 'rental_shops' when 'happening' then 'happenings' else null end;
  if tbl is null then raise exception '未知的店家類別:%', c.kind; end if;
  execute format('update public.%I set owner_id = $1 where id = $2', tbl) using c.applicant_id, c.target_id;
  update public.profiles set role = 'partner' where id = c.applicant_id and role = 'user';
  update public.claims set status = 'approved', updated_at = now() where id = p_claim;
  begin insert into public.notifications (user_id, kind, title, href)
    values (c.applicant_id, 'claim_approved', '你的認領「'||coalesce(nullif(c.target_name,''),'店家')||'」已通過,現在可到業者後台管理 🎉', '/vendor'); exception when others then null; end;
  return 'ok';
end $fn$;
revoke all on function public.claim_approve(uuid) from public;
grant execute on function public.claim_approve(uuid) to authenticated;
