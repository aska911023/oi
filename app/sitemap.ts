import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { STAY_THEMES } from "@/lib/rooms";

const BASE = "https://www.oi-stay.com";

export const revalidate = 3600; // 每小時重算一次

type R = { region?: string };
type PlaceRow = { id: string; slug?: string; region?: string };
const distinct = (rows: R[]) => Array.from(new Set(rows.map((r) => r.region).filter(Boolean))) as string[];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const enc = encodeURIComponent;
  const mk = (path: string, priority: number, changeFrequency: "daily" | "weekly" = "daily") => ({ url: `${BASE}${path}`, lastModified: now, changeFrequency, priority });

  // 靜態頁(含「全台」分類總覽)
  const staticRoutes: MetadataRoute.Sitemap = [
    "", "/trips", "/rentals", "/plan", "/stations",
    "/places/attraction", "/places/food", "/places/parking",
    "/about", "/contact", "/apply",
  ].map((p) => mk(p, p === "" ? 1 : 0.6));

  try {
    const sb = createPublicClient();
    const [staysR, tripsR, attrR, foodR, parkR] = await Promise.all([
      sb.from("stays").select("id, slug, updated_at, region, category").eq("published", true).eq("approved", true).eq("visibility", "published").limit(5000),
      sb.from("trips").select("id, slug, updated_at, region").eq("is_public", true).limit(5000),
      sb.from("attractions").select("id, slug, region").eq("published", true),
      sb.from("restaurants").select("id, slug, region").eq("published", true),
      sb.from("parking_lots").select("id, slug, region").eq("published", true),
    ]);
    const stays = (staysR.data || []) as { id: string; slug?: string; updated_at?: string; region?: string; category?: string }[];
    const trips = (tripsR.data || []) as { id: string; slug?: string; updated_at?: string; region?: string }[];
    const attrs = (attrR.data || []) as PlaceRow[];
    const foods = (foodR.data || []) as PlaceRow[];
    const parks = (parkR.data || []) as PlaceRow[];
    const stayRegions = distinct(stays);
    const attrRegions = distinct(attrs);
    const foodRegions = distinct(foods);
    const parkRegions = distinct(parks);
    const tripRegions = distinct(trips);

    // 城市 hub(有任何內容的縣市,避免薄頁)
    const allRegions = Array.from(new Set([...stayRegions, ...attrRegions, ...foodRegions, ...parkRegions, ...tripRegions]));
    const cityHubs = allRegions.map((r) => mk(`/${enc(r)}`, 0.9));
    // 城市×分類列表(只收錄真有資料的組合)
    const hotelLists = stayRegions.map((r) => mk(`/${enc(r)}/hotels`, 0.85));
    const attrLists = attrRegions.map((r) => mk(`/${enc(r)}/attractions`, 0.8));
    const foodLists = foodRegions.map((r) => mk(`/${enc(r)}/restaurants`, 0.8));
    const parkLists = parkRegions.map((r) => mk(`/${enc(r)}/parking`, 0.7));
    const itinLists = tripRegions.map((r) => mk(`/${enc(r)}/itineraries`, 0.6));
    // 住宿主題長尾(只收錄真有該組合、且為有效主題)
    const themeCats = new Set(STAY_THEMES.map((t) => t.cat));
    const combos = Array.from(new Set(stays.filter((s) => s.region && s.category && themeCats.has(s.category)).map((s) => `${s.region}|${s.category}`)));
    const themeRoutes = combos.map((c) => { const [r, cat] = c.split("|"); return mk(`/${enc(r)}/hotels/${enc(cat)}`, 0.8); });

    // entity(P1 維持 /stay、/trips;P2 民宿改 /{city}/hotel/{slug} 時一併更新)
    // entity 詳情:民宿 /{region}/hotel/{slug}、景點/餐廳/停車 /{region}/{kind}/{slug}
    const stayRoutes: MetadataRoute.Sitemap = stays.filter((s) => s.region).map((s) => ({ url: `${BASE}/${enc(s.region!)}/hotel/${enc(s.slug || s.id)}`, lastModified: s.updated_at ? new Date(s.updated_at) : now, changeFrequency: "weekly", priority: 0.8 }));
    const tripRoutes: MetadataRoute.Sitemap = trips.map((t) => ({ url: `${BASE}/trips/${enc(t.slug || t.id)}`, lastModified: t.updated_at ? new Date(t.updated_at) : now, changeFrequency: "weekly", priority: 0.6 }));
    const placeRoutes = (rows: PlaceRow[], kindSeg: string): MetadataRoute.Sitemap => rows.filter((r) => r.region).map((r) => mk(`/${enc(r.region!)}/${kindSeg}/${enc(r.slug || r.id)}`, 0.7, "weekly"));
    const entityRoutes = [...placeRoutes(attrs, "attraction"), ...placeRoutes(foods, "restaurant"), ...placeRoutes(parks, "parking")];

    return [...staticRoutes, ...cityHubs, ...hotelLists, ...attrLists, ...foodLists, ...parkLists, ...itinLists, ...themeRoutes, ...stayRoutes, ...tripRoutes, ...entityRoutes];
  } catch {
    return staticRoutes;
  }
}
