-- 2026/10 大功能批次:娛樂/外燴分類、線上訂房 RPC、聊天室、異業合作。
-- 註:這批原本以 Management API 直接建在線上 DB(專案慣例),此檔補成版控來源。
-- 全程 idempotent(IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS),可安全重跑。

-- ========== 1. 娛樂(activities)/ 外燴(caterings)分類:比照 attractions ==========
do $$
declare t text;
begin
  foreach t in array array['activities','caterings'] loop
    execute format('create table if not exists public.%I (like public.attractions including all)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format($p$create policy %I on public.%I for select to public using ((published = true) or is_admin() or (owner_id = auth.uid()))$p$, t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_ins', t);
    execute format($p$create policy %I on public.%I for insert to public with check (is_admin() or (owner_id = auth.uid()))$p$, t||'_ins', t);
    execute format('drop policy if exists %I on public.%I', t||'_upd', t);
    execute format($p$create policy %I on public.%I for update to public using (is_admin() or (owner_id = auth.uid())) with check (is_admin() or (owner_id = auth.uid()))$p$, t||'_upd', t);
    execute format('drop policy if exists %I on public.%I', t||'_del', t);
    execute format($p$create policy %I on public.%I for delete to public using (is_admin() or (owner_id = auth.uid()))$p$, t||'_del', t);
    execute format('drop trigger if exists %I on public.%I', 'trg_'||t||'_slug', t);
    execute format('create trigger %I before insert on public.%I for each row execute function tg_place_slug()', 'trg_'||t||'_slug', t);
    execute format('drop trigger if exists %I on public.%I', 'trg_'||t||'_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function touch_updated_at()', 'trg_'||t||'_touch', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ========== 2. 線上訂房 RPC(消費者,免金流;吃 booking_enabled、算訂金)==========
create or replace function public.create_booking(
  p_stay_id uuid, p_check_in date, p_check_out date, p_adults int, p_children int,
  p_guest_name text, p_guest_phone text, p_guest_email text, p_note text, p_rooms jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid := auth.uid(); v_enabled boolean; v_pct numeric; v_nights int; v_code text;
  v_bid uuid; v_sub numeric := 0; v_dep numeric := 0; r jsonb; rt record; v_qty int; v_line numeric;
begin
  if v_uid is null then raise exception '請先登入才能訂房'; end if;
  if coalesce(trim(p_guest_name),'')='' or coalesce(trim(p_guest_phone),'')='' then raise exception '請填寫姓名與電話'; end if;
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then raise exception '請選擇正確的入住與退房日期'; end if;
  if p_check_in < current_date then raise exception '入住日不可早於今天'; end if;
  select booking_enabled, coalesce(booking_deposit_pct,0) into v_enabled, v_pct
    from public.stays where id=p_stay_id and published and approved and visibility='published';
  if not found then raise exception '民宿不存在或未開放訂房'; end if;
  if not coalesce(v_enabled,false) then raise exception '此民宿尚未開放線上訂房,請改用官方管道'; end if;
  v_nights := p_check_out - p_check_in;
  v_code := 'OI'||to_char(now(),'YYMMDD')||upper(substr(md5(random()::text),1,4));
  insert into public.bookings (stay_id, code, source, status, guest_name, guest_phone, guest_email,
    adults, children, check_in, check_out, nights, subtotal, discount, total, deposit_amount, guest_note, created_by)
    values (p_stay_id, v_code, 'web', 'pending', trim(p_guest_name), trim(p_guest_phone), nullif(trim(p_guest_email),''),
    coalesce(p_adults,1), coalesce(p_children,0), p_check_in, p_check_out, v_nights, 0, 0, 0, 0, nullif(trim(p_note),''), v_uid)
    returning id into v_bid;
  for r in select value from jsonb_array_elements(coalesce(p_rooms,'[]'::jsonb)) loop
    v_qty := greatest(coalesce((r->>'qty')::int,1),1);
    select id, name, price into rt from public.room_types where id=(r->>'room_type_id')::uuid and stay_id=p_stay_id;
    if rt.id is null then continue; end if;
    v_line := coalesce(rt.price,0)*v_qty*v_nights; v_sub := v_sub + v_line;
    insert into public.booking_rooms (booking_id, room_type_id, room_name, qty, nights, unit_price, line_total)
      values (v_bid, rt.id, rt.name, v_qty, v_nights, coalesce(rt.price,0), v_line);
  end loop;
  v_dep := round(v_sub * v_pct / 100);
  update public.bookings set subtotal=v_sub, total=v_sub, deposit_amount=v_dep where id=v_bid;
  begin insert into public.booking_events (booking_id, action, from_status, to_status, actor, note)
    values (v_bid, 'pending', null, 'pending', v_uid, '房客線上訂房'); exception when others then null; end;
  return v_code;
end $fn$;
revoke execute on function public.create_booking(uuid,date,date,int,int,text,text,text,text,jsonb) from public, anon;
grant execute on function public.create_booking(uuid,date,date,int,int,text,text,text,text,jsonb) to authenticated;

-- ========== 3. 聊天室:conversations / messages / conversation_reads ==========
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), kind text not null,
  vendor_id uuid, customer_id uuid, stay_id uuid, subject text not null default '',
  created_at timestamptz not null default now(), last_at timestamptz not null default now());
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conv_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid(), body text not null, created_at timestamptz not null default now());
create index if not exists idx_messages_conv on public.messages(conv_id, created_at);
create table if not exists public.conversation_reads (
  conv_id uuid not null, user_id uuid not null default auth.uid(),
  last_read_at timestamptz not null default now(), primary key (conv_id, user_id));
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
drop policy if exists conv_sel on public.conversations;
create policy conv_sel on public.conversations for select to authenticated using (is_admin() or vendor_id=auth.uid() or customer_id=auth.uid());
drop policy if exists conv_upd on public.conversations;
create policy conv_upd on public.conversations for update to authenticated using (is_admin() or vendor_id=auth.uid() or customer_id=auth.uid()) with check (is_admin() or vendor_id=auth.uid() or customer_id=auth.uid());
drop policy if exists msg_sel on public.messages;
create policy msg_sel on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id=conv_id and (is_admin() or c.vendor_id=auth.uid() or c.customer_id=auth.uid())));
drop policy if exists msg_ins on public.messages;
create policy msg_ins on public.messages for insert to authenticated with check (sender_id=auth.uid() and exists (select 1 from public.conversations c where c.id=conv_id and (is_admin() or c.vendor_id=auth.uid() or c.customer_id=auth.uid())));
drop policy if exists cr_all on public.conversation_reads;
create policy cr_all on public.conversation_reads for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select, insert, update, delete on public.conversations, public.messages, public.conversation_reads to authenticated;
grant all on public.conversations, public.messages, public.conversation_reads to service_role;

create or replace function public.tg_msg_touch_conv() returns trigger language plpgsql security definer set search_path=public as $t$
begin update public.conversations set last_at=now() where id=new.conv_id; return new; end $t$;
drop trigger if exists trg_msg_touch on public.messages;
create trigger trg_msg_touch after insert on public.messages for each row execute function public.tg_msg_touch_conv();

create or replace function public.get_or_create_conversation(p_kind text, p_stay_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid := auth.uid(); v_vendor uuid; v_conv uuid;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  if p_kind='booking' then
    select owner_id into v_vendor from public.stays where id=p_stay_id and published and approved and visibility='published';
    if v_vendor is null then raise exception '此民宿目前不支援線上聯繫,請改用官方管道'; end if;
    select id into v_conv from public.conversations where kind='booking' and stay_id=p_stay_id and customer_id=v_uid limit 1;
    if v_conv is null then insert into public.conversations(kind,vendor_id,customer_id,stay_id) values('booking',v_vendor,v_uid,p_stay_id) returning id into v_conv; end if;
  elsif p_kind='support' then
    select id into v_conv from public.conversations where kind='support' and vendor_id=v_uid limit 1;
    if v_conv is null then insert into public.conversations(kind,vendor_id) values('support',v_uid) returning id into v_conv; end if;
  else raise exception 'bad kind'; end if;
  return v_conv;
end $fn$;
revoke execute on function public.get_or_create_conversation(text,uuid) from public, anon;
grant execute on function public.get_or_create_conversation(text,uuid) to authenticated;

-- 即時推送(messages）
do $$ begin alter publication supabase_realtime add table public.messages; exception when others then null; end $$;

-- ========== 4. 異業合作 partnership_posts ==========
create table if not exists public.partnership_posts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), stay_id uuid,
  title text not null, category text not null default '其他', detail text not null default '',
  contact text not null default '', status text not null default 'open',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.partnership_posts enable row level security;
drop policy if exists pp_sel on public.partnership_posts;
create policy pp_sel on public.partnership_posts for select to authenticated using ((status='open' and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('partner','admin'))) or owner_id=auth.uid() or is_admin());
drop policy if exists pp_ins on public.partnership_posts;
create policy pp_ins on public.partnership_posts for insert to authenticated with check (owner_id=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('partner','admin')));
drop policy if exists pp_upd on public.partnership_posts;
create policy pp_upd on public.partnership_posts for update to authenticated using (owner_id=auth.uid() or is_admin()) with check (owner_id=auth.uid() or is_admin());
drop policy if exists pp_del on public.partnership_posts;
create policy pp_del on public.partnership_posts for delete to authenticated using (owner_id=auth.uid() or is_admin());
drop trigger if exists trg_pp_touch on public.partnership_posts;
create trigger trg_pp_touch before update on public.partnership_posts for each row execute function touch_updated_at();
grant select, insert, update, delete on public.partnership_posts to authenticated;
grant all on public.partnership_posts to service_role;

-- ========== 5. 索引 ==========
create index if not exists idx_conv_vendor on public.conversations(vendor_id, last_at desc);
create index if not exists idx_conv_customer on public.conversations(customer_id, last_at desc);
create index if not exists idx_conv_kind on public.conversations(kind, last_at desc);
create index if not exists idx_bookings_stay on public.bookings(stay_id, created_at desc);
create index if not exists idx_pp_status on public.partnership_posts(status, created_at desc);
