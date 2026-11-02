-- 線上訂房總開關:全站一鍵隱藏/開啟前台訂房入口(預設關,下週補完後在後台打開)
alter table public.site_settings add column if not exists booking_live boolean not null default false;
