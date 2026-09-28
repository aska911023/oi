import { createClient } from "@supabase/supabase-js";

// 僅伺服器端使用:service_role 繞過 RLS,做 admin 寫入/查詢。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
