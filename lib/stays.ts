import { unstable_cache } from "next/cache";
import { SAMPLE_STAYS } from "./data";
import { createPublicClient } from "./supabase/public";
import type { Stay } from "./types";

export function hasSupabase() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const PAGE = 24;
const distinctRegions = (arr: Stay[]) => Array.from(new Set(arr.map((s) => s.region)));

// 前台首頁:第一頁(RPC 分頁)+ 總數 + 地區清單。DB 無資料 → 範例 fallback。
// 公開資料 → unstable_cache 跨請求快取(tag: stays;後台存檔會 revalidate)。
export const getStaysInitial = unstable_cache(async (): Promise<{ stays: Stay[]; total: number; usingSamples: boolean; regions: string[] }> => {
  if (!hasSupabase()) return { stays: SAMPLE_STAYS, total: SAMPLE_STAYS.length, usingSamples: true, regions: distinctRegions(SAMPLE_STAYS) };
  try {
    const sb = createPublicClient();
    const { data } = await sb.rpc("search_stays", { lim: PAGE, off: 0 });
    const total: number = data?.total ?? 0;
    if (!total) return { stays: SAMPLE_STAYS, total: SAMPLE_STAYS.length, usingSamples: true, regions: distinctRegions(SAMPLE_STAYS) };
    const { data: rg } = await sb.from("stays").select("region").eq("published", true).eq("visibility", "published");
    const regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region)));
    return { stays: (data.rows || []) as Stay[], total, usingSamples: false, regions };
  } catch {
    return { stays: SAMPLE_STAYS, total: SAMPLE_STAYS.length, usingSamples: true, regions: distinctRegions(SAMPLE_STAYS) };
  }
}, ["stays-initial"], { tags: ["stays"], revalidate: 120 });

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
