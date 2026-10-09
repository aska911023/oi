// 城市優先架構(SEO)共用設定與資料層。
// 網址:/{縣市}/ ·  /{縣市}/{hotels|restaurants|attractions|parking|itineraries}/
// 城市來源 = 既有地理資料的縣市清單(資料驅動,不另建表)。
import { GEOGRAPHIC_AREAS } from "./data";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import { sbRetry } from "./retry";
import { KIND_TABLE } from "./places-config";
import { extractUuid } from "./slug";
import type { Place, PoiKind, Stay, Trip } from "./types";

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

// kind → entity 單數段(詳情頁網址用)
export const KIND_SINGULAR: Record<PoiKind, string> = { attraction: "attraction", food: "restaurant", parking: "parking" };

// 乾淨 entity 網址
export const stayHref = (region: string, slug: string) => `/${encodeURIComponent(region)}/hotel/${encodeURIComponent(slug)}`;
export const placeHref = (kind: PoiKind, region: string, slug: string) => `/${encodeURIComponent(region)}/${KIND_SINGULAR[kind]}/${encodeURIComponent(slug)}`;

// 以 slug 取單筆(找不到再用網址裡的 UUID,相容舊連結)
export async function getStayBySlug(param: string): Promise<Stay | null> {
  if (!hasSupabase()) return null;
  const sb = createPublicClient();
  let { data } = await sb.from("stays").select("*").eq("slug", param).maybeSingle();
  if (!data) { const uuid = extractUuid(param); if (uuid) ({ data } = await sb.from("stays").select("*").eq("id", uuid).maybeSingle()); }
  return (data as Stay) || null;
}

export async function getPlaceBySlug(kind: PoiKind, param: string): Promise<Place | null> {
  if (!hasSupabase()) return null;
  const sb = createPublicClient();
  const table = KIND_TABLE[kind];
  let { data } = await sb.from(table).select("*").eq("slug", param).maybeSingle();
  if (!data) { const uuid = extractUuid(param); if (uuid) ({ data } = await sb.from(table).select("*").eq("id", uuid).maybeSingle()); }
  return (data as Place) || null;
}

// ── 附近互連(entity_relationship_network):同縣市 + 有經緯度則依距離排序 ──
export type NearItem = { id: string; name: string; href: string; dist?: number };
type Geo = { id: string; name: string; slug?: string; lat?: number | null; lng?: number | null };
const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371, dLat = (bLat - aLat) * Math.PI / 180, dLng = (bLng - aLng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export async function getNearby(region: string, lat?: number | null, lng?: number | null, excludeId?: string): Promise<{ hotels: NearItem[]; attractions: NearItem[]; restaurants: NearItem[]; parking: NearItem[] }> {
  const empty = { hotels: [] as NearItem[], attractions: [] as NearItem[], restaurants: [] as NearItem[], parking: [] as NearItem[] };
  if (!hasSupabase()) return empty;
  try {
    const sb = createPublicClient();
    const cols = "id,name,slug,lat,lng";
    const [st, at, fo, pa] = await Promise.all([
      sb.from("stays").select(cols).eq("published", true).eq("approved", true).eq("visibility", "published").eq("region", region).limit(30),
      sb.from("attractions").select(cols).eq("published", true).eq("region", region).limit(30),
      sb.from("restaurants").select(cols).eq("published", true).eq("region", region).limit(30),
      sb.from("parking_lots").select(cols).eq("published", true).eq("region", region).limit(30),
    ]);
    const enc = encodeURIComponent;
    const near = (rows: Geo[] | null, hrefFn: (r: Geo) => string): NearItem[] => {
      const items = (rows || []).filter((r) => r.id !== excludeId).map((r) => ({
        id: r.id, name: r.name, href: hrefFn(r),
        dist: (lat != null && lng != null && r.lat != null && r.lng != null) ? haversineKm(lat, lng, r.lat, r.lng) : undefined,
      }));
      items.sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
      return items.slice(0, 6);
    };
    return {
      hotels: near(st.data as Geo[], (r) => `/${enc(region)}/hotel/${enc(r.slug || r.id)}`),
      attractions: near(at.data as Geo[], (r) => `/${enc(region)}/attraction/${enc(r.slug || r.id)}`),
      restaurants: near(fo.data as Geo[], (r) => `/${enc(region)}/restaurant/${enc(r.slug || r.id)}`),
      parking: near(pa.data as Geo[], (r) => `/${enc(region)}/parking/${enc(r.slug || r.id)}`),
    };
  } catch { return empty; }
}
