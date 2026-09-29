import { unstable_cache } from "next/cache";
import type { Poi, PoiKind } from "./types";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";

const PAGE = 24;

// 前台某分類:第一頁(RPC 分頁)+ 總數 + 地區清單。公開資料 → 跨請求快取(tag: pois)。
export function getPoisInitial(kind: PoiKind): Promise<{ pois: Poi[]; total: number; regions: string[] }> {
  return unstable_cache(async () => {
    if (!hasSupabase()) return { pois: [], total: 0, regions: [] };
    try {
      const sb = createPublicClient();
      const { data } = await sb.rpc("search_pois", { p_kind: kind, lim: PAGE, off: 0 });
      const total: number = data?.total ?? 0;
      let regions: string[] = [];
      if (total) {
        const { data: rg } = await sb.from("pois").select("region").eq("kind", kind).eq("published", true);
        regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region)));
      }
      return { pois: (data?.rows || []) as Poi[], total, regions };
    } catch {
      return { pois: [], total: 0, regions: [] };
    }
  }, ["pois-initial", kind], { tags: ["pois"], revalidate: 120 })();
}

// 前台:取得某分類已發布的地點(景點/美食/停車)。無 Supabase → 空陣列。
export async function getPublishedPois(kind: PoiKind): Promise<Poi[]> {
  if (!hasSupabase()) return [];
  try {
    const { createClient } = await import("./supabase/server");
    const sb = await createClient();
    const { data, error } = await sb
      .from("pois")
      .select("*")
      .eq("kind", kind)
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as Poi[];
  } catch {
    return [];
  }
}
