-- ============================================================
-- 訂房系統地基 — 業者後台收單 / 確認制 / 房況日曆 / 記帳
--   確認制(pending -> confirmed/rejected);平台先不經手金流(payments 純記帳,為線上金流預留 provider 欄)
--   沿用現有 stays / room_types(rooms_total + pricing 四時期價),不重建
--   RLS:is_admin() 或透過 stays.owner_id 隔離,業者只看自己
--   可改性:訂金比例 / 是否啟用訂房 做成 per-store 欄位(不寫死)
-- ============================================================

-- ---- per-store 設定(可後台改,不寫死) ----
alter table public.stays add column if not exists booking_enabled   boolean not null default false; -- 是否對這間啟用訂房後台(預設關=先不出現)
alter table public.stays add column if not exists booking_deposit_pct integer not null default 30;   -- 訂金比例 %(可改)
alter table public.stays add column if not exists booking_note       text    not null default '';     -- 訂房須知 / 確認訊息範本

-- ---- 1. 訂單主檔 ----
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  stay_id       uuid not null references public.stays(id) on delete cascade,
  code          text not null,                                   -- 給客人報的短碼 OI-XXXX
  source        text not null default 'manual' check (source in ('manual','web','line','ota')),
  status        text not null default 'pending'
                  check (status in ('pending','confirmed','rejected','checked_in','completed','cancelled','no_show')),
  guest_name    text not null default '',
  guest_phone   text not null default '',
  guest_email   text not null default '',
  adults        integer not null default 2,
  children      integer not null default 0,
  check_in      date not null,
  check_out     date not null,
  nights        integer generated always as (check_out - check_in) stored,
  subtotal      numeric not null default 0,
  discount      numeric not null default 0,
  total         numeric not null default 0,
  deposit_amount numeric not null default 0,                     -- 應收訂金(記帳,之後金流用)
  guest_note    text not null default '',
  staff_note    text not null default '',
  cancel_reason text not null default '',
  confirmed_at  timestamptz,
  cancelled_at  timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint bookings_dates_chk check (check_out > check_in)
);
create unique index if not exists bookings_code_key   on public.bookings(code);
create index if not exists bookings_stay_status_idx   on public.bookings(stay_id, status);
create index if not exists bookings_stay_checkin_idx  on public.bookings(stay_id, check_in);
create index if not exists bookings_checkin_idx       on public.bookings(check_in);

-- ---- 2. 訂單房型明細(一單可多房型) ----
create table if not exists public.booking_rooms (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  room_type_id uuid references public.room_types(id) on delete set null,
  room_name    text not null default '',                         -- 快照房型名(房型被刪仍保留)
  qty          integer not null default 1,
  nights       integer not null default 1,
  unit_price   numeric not null default 0,
  line_total   numeric not null default 0
);
create index if not exists booking_rooms_booking_idx on public.booking_rooms(booking_id);
create index if not exists booking_rooms_rt_idx      on public.booking_rooms(room_type_id);

-- ---- 3. 每日房況(sparse:只在關房/改量/覆寫價時寫列) ----
create table if not exists public.room_availability (
  room_type_id   uuid not null references public.room_types(id) on delete cascade,
  date           date not null,
  inventory      integer,                                        -- null = 用 room_types.rooms_total
  closed         boolean not null default false,
  price_override numeric,                                        -- null = 用 room_types.pricing 規則
  note           text not null default '',
  updated_at     timestamptz not null default now(),
  primary key (room_type_id, date)
);
create index if not exists room_avail_date_idx on public.room_availability(date);

-- ---- 4. 收款記錄(純記帳;provider 為線上金流預留) ----
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  kind         text not null default 'deposit' check (kind in ('deposit','balance','refund')),
  method       text not null default 'transfer' check (method in ('transfer','cash','card','other')),
  amount       numeric not null default 0,                       -- 退款為負
  provider     text,                                             -- null = 線下;之後 ecpay / stripe
  provider_ref text,
  note         text not null default '',
  received_at  timestamptz not null default now(),
  recorded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists payments_booking_idx on public.payments(booking_id);

-- ---- 5. 狀態軌跡(稽核) ----
create table if not exists public.booking_events (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  action      text not null,
  from_status text,
  to_status   text,
  actor       uuid references public.profiles(id) on delete set null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists booking_events_booking_idx on public.booking_events(booking_id);

-- ============================================================
-- 權限 + RLS
-- ============================================================
grant select, insert, update, delete on public.bookings, public.booking_rooms,
  public.room_availability, public.payments, public.booking_events to authenticated;
grant select on public.room_availability to anon; -- 之後前台查空房用(唯讀)

alter table public.bookings          enable row level security;
alter table public.booking_rooms     enable row level security;
alter table public.room_availability enable row level security;
alter table public.payments          enable row level security;
alter table public.booking_events    enable row level security;

-- bookings:業者(本店 owner)或 admin
drop policy if exists bookings_all on public.bookings;
create policy bookings_all on public.bookings for all
  using (public.is_admin() or exists (
    select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));

-- booking_rooms / payments / booking_events:透過 booking -> stay 往上判
drop policy if exists booking_rooms_all on public.booking_rooms;
create policy booking_rooms_all on public.booking_rooms for all
  using (public.is_admin() or exists (
    select 1 from public.bookings b join public.stays s on s.id = b.stay_id
     where b.id = booking_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.bookings b join public.stays s on s.id = b.stay_id
     where b.id = booking_id and s.owner_id = auth.uid()));

drop policy if exists payments_all on public.payments;
create policy payments_all on public.payments for all
  using (public.is_admin() or exists (
    select 1 from public.bookings b join public.stays s on s.id = b.stay_id
     where b.id = booking_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.bookings b join public.stays s on s.id = b.stay_id
     where b.id = booking_id and s.owner_id = auth.uid()));

drop policy if exists booking_events_all on public.booking_events;
create policy booking_events_all on public.booking_events for all
  using (public.is_admin() or exists (
    select 1 from public.bookings b join public.stays s on s.id = b.stay_id
     where b.id = booking_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.bookings b join public.stays s on s.id = b.stay_id
     where b.id = booking_id and s.owner_id = auth.uid()));

-- room_availability:業者/admin 可寫;anon/登入者可讀(為前台查空房預留)
drop policy if exists room_avail_sel on public.room_availability;
create policy room_avail_sel on public.room_availability for select using (true);

drop policy if exists room_avail_write on public.room_availability;
create policy room_avail_write on public.room_availability for all
  using (public.is_admin() or exists (
    select 1 from public.room_types rt join public.stays s on s.id = rt.stay_id
     where rt.id = room_type_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.room_types rt join public.stays s on s.id = rt.stay_id
     where rt.id = room_type_id and s.owner_id = auth.uid()));
