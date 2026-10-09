import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { STAY_THEMES } from "@/lib/rooms";

const BASE = "https://www.oi-stay.com";

export const revalidate = 3600; // 每小時重算一次

type R = { region?: string };
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
      sb.from("attractions").select("region").eq("published", true),
      sb.from("restaurants").select("region").eq("published", true),
      sb.from("parking_lots").select("region").eq("published", true),
    ]);
    const stays = (staysR.data || []) as { id: string; slug?: string; updated_at?: string; region?: string; category?: string }[];
    const trips = (tripsR.data || []) as { id: string; slug?: string; updated_at?: string; region?: string }[];
    const stayRegions = distinct(stays);
    const attrRegions = distinct((attrR.data || []) as R[]);
    const foodRegions = distinct((foodR.data || []) as R[]);
    const parkRegions = distinct((parkR.data || []) as R[]);
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
    const stayRoutes: MetadataRoute.Sitemap = stays.map((s) => ({ url: `${BASE}/stay/${enc(s.slug || s.id)}`, lastModified: s.updated_at ? new Date(s.updated_at) : now, changeFrequency: "weekly", priority: 0.8 }));
    const tripRoutes: MetadataRoute.Sitemap = trips.map((t) => ({ url: `${BASE}/trips/${enc(t.slug || t.id)}`, lastModified: t.updated_at ? new Date(t.updated_at) : now, changeFrequency: "weekly", priority: 0.6 }));

    return [...staticRoutes, ...cityHubs, ...hotelLists, ...attrLists, ...foodLists, ...parkLists, ...itinLists, ...themeRoutes, ...stayRoutes, ...tripRoutes];
  } catch {
    return staticRoutes;
  }
}
