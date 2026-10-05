import { createClient } from "@/lib/supabase/client";

// 事件埋點(靜默、失敗不影響使用者)。type 例:stay_view / click_website / click_map / click_phone / click_line
export async function track(type: string, opts?: { stayId?: string; roomId?: string; meta?: Record<string, unknown> }) {
  try {
    const sb = createClient();
    await sb.rpc("log_event", {
      p_type: type,
      p_stay: opts?.stayId ?? null,
      p_room: opts?.roomId ?? null,
      p_meta: opts?.meta ?? {},
    });
  } catch { /* 靜默 */ }
}
