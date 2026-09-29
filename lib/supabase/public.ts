import { createClient } from "@supabase/supabase-js";

// 公開讀取用的 client(不帶 cookie/session),搭配 unstable_cache 做跨請求快取。
// 只讀 RLS 允許 anon 看到的公開資料(已上架民宿、已發布景點、公開行程、站台設定)。
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
