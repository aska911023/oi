import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import { KIND_TABLE } from "./places-config";
import type { Place, PoiKind } from "./types";

export * from "./places-config";

const PAGE = 24;

async function _placeInitial(kind: PoiKind) {
  if (!hasSupabase()) return { places: [] as Place[], total: 0, regions: [] as string[] };
  try {
    const sb = createPublicClient();
    const table = KIND_TABLE[kind];
    const { data, count } = await sb.from(table).select("*", { count: "exact" })
      .eq("published", true).order("featured", { ascending: false }).order("created_at", { ascending: false }).range(0, PAGE - 1);
    const total = count ?? 0;
    let regions: string[] = [];
    if (total) {
      const { data: rg } = await sb.from(table).select("region").eq("published", true);
      regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region)));
    }
    return { places: (data || []) as Place[], total, regions };
  } catch {
    return { places: [] as Place[], total: 0, regions: [] as string[] };
  }
}

export function getPlaceInitial(kind: PoiKind) {
  return unstable_cache(() => _placeInitial(kind), ["place-initial", kind], { tags: ["pois"], revalidate: 120 })();
}

// 給行程規劃器用:某分類全部已發布(名稱/地區用)
export async function getPublishedPlaces(kind: PoiKind): Promise<Place[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = createPublicClient();
    const { data } = await sb.from(KIND_TABLE[kind]).select("*").eq("published", true).order("created_at", { ascending: false });
    return (data || []) as Place[];
  } catch {
    return [];
  }
}
