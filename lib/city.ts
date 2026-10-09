// 城市優先架構(SEO)共用設定與資料層。
// 網址:/{縣市}/ ·  /{縣市}/{hotels|restaurants|attractions|parking|itineraries}/
// 城市來源 = 既有地理資料的縣市清單(資料驅動,不另建表)。
import { GEOGRAPHIC_AREAS } from "./data";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import { sbRetry } from "./retry";
import { KIND_TABLE } from "./places-config";
import type { Place, PoiKind, Trip } from "./types";

export const CITIES: string[] = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
export const isCity = (c: string): boolean => CITIES.includes(c);

export type Section = "hotels" | "restaurants" | "attractions" | "parking" | "itineraries";

// 複數=列表段;kind 對應 places 分類;singular=對應的 entity 單數段(詳情頁用)
export const SECTIONS: { seg: Section; label: string; kind?: PoiKind; singular?: string }[] = [
  { seg: "hotels", label: "住宿" },
  { seg: "attractions", label: "景點", kind: "attraction", singular: "attraction" },
  { seg: "restaurants", label: "美食", kind: "food", singular: "restaurant" },
  { seg: "parking", label: "停車", kind: "parking", singular: "parking" },
  { seg: "itineraries", label: "行程" },
];
export const SECTION_SET = new Set<string>(SECTIONS.map((s) => s.seg));

// 單數 entity 段 → places kind(hotel 另走 stays,不在此表)
export const ENTITY_KIND: Record<string, PoiKind> = { attraction: "attraction", restaurant: "food", parking: "parking" };

// 某縣市某類已發布 places(列表第一頁 + 總數)
export async function getCityPlaces(kind: PoiKind, region: string, limit = 48): Promise<{ places: Place[]; total: number }> {
  if (!hasSupabase()) return { places: [], total: 0 };
  const sb = createPublicClient();
  const { data, count } = await sbRetry<Place[]>(
    () => sb.from(KIND_TABLE[kind]).select("*", { count: "exact" }).eq("published", true).eq("region", region)
      .order("featured", { ascending: false }).order("created_at", { ascending: false }).range(0, limit - 1),
    `city-places:${kind}:${region}`);
  return { places: (data || []) as Place[], total: count ?? 0 };
}

// 某縣市公開行程(itineraries 列表)
export async function getCityTrips(region: string): Promise<Trip[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("trips").select("*").eq("is_public", true).eq("region", region)
      .order("created_at", { ascending: false }).limit(48);
    return (data || []) as Trip[];
  } catch { return []; }
}
