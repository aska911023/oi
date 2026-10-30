"use client";

import { createBrowserClient } from "@supabase/ssr";

// 單例:整個瀏覽器分頁共用同一個 client,避免每次呼叫(尤其聊天室輪詢)都新建連線 → 省資源、更順。
let _client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}
