import { createClient } from "@/lib/supabase/client";

// 後台操作紀錄:任何 admin 元件都呼叫這支寫入 admin_logs。
// actor 身分一個 SPA session 內只解析一次就快取,避免每次都打 auth/profiles。
// RLS 只允許 admin 且 actor_id=自己寫入;非 admin 呼叫會被擋下(靜默忽略)。
let me: { id: string; name: string } | null = null;

export interface LogTarget {
  type?: string;                       // 'stay' | 'room' | 'vendor' | 'plan' | 'site' | 'member' | 'place' | 'rental' …
  id?: string | null;
  name?: string | null;
  detail?: Record<string, unknown> | null;
}

export async function logAdmin(action: string, target: LogTarget = {}): Promise<void> {
  const sb = createClient();
  if (!me) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    let name = user.email || "admin";
    const { data: p } = await sb.from("profiles").select("display_name,full_name").eq("id", user.id).maybeSingle();
    if (p) name = p.display_name || p.full_name || name;
    me = { id: user.id, name };
  }
  await sb.from("admin_logs").insert({
    actor_id: me.id, actor_name: me.name,
    action,
    target_type: target.type ?? "stay",
    target_id: target.id ?? null,
    target_name: target.name ?? null,
    detail: target.detail ?? null,
  }).then(() => {}, () => {}); // 寫 log 失敗不影響主流程
}
