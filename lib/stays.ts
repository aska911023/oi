import { SAMPLE_STAYS } from "./data";
import type { Stay } from "./types";

export function hasSupabase() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// 前台:取得已上架民宿。無 Supabase 或資料庫尚無資料 → 用範例(對齊 JSON 的 fallback 規則)。
export async function getPublishedStays(): Promise<{ stays: Stay[]; usingSamples: boolean }> {
  if (!hasSupabase()) return { stays: SAMPLE_STAYS, usingSamples: true };
  try {
    const { createClient } = await import("./supabase/server");
    const sb = await createClient();
    const { data, error } = await sb
      .from("stays")
      .select("*")
      .eq("published", true)
      .eq("visibility", "published")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return { stays: SAMPLE_STAYS, usingSamples: true };
    return { stays: data as Stay[], usingSamples: false };
  } catch {
    return { stays: SAMPLE_STAYS, usingSamples: true };
  }
}
