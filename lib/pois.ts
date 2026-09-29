import type { Poi, PoiKind } from "./types";
import { hasSupabase } from "./stays";

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
