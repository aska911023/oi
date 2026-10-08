import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { STAY_THEMES } from "@/lib/rooms";

const BASE = "https://www.oi-stay.com";

export const revalidate = 3600; // 每小時重算一次

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // 靜態頁
  const staticRoutes: MetadataRoute.Sitemap = [
    "", "/trips", "/rentals", "/plan", "/stations",
    "/places/attraction", "/places/food", "/places/parking",
    "/about", "/contact", "/apply",
  ].map((p) => ({ url: `${BASE}${p}`, lastModified: now, changeFrequency: "daily", priority: p === "" ? 1 : 0.7 }));

  try {
    const sb = createPublicClient();
    const [{ data: stays }, { data: trips }] = await Promise.all([
      // 只收錄前台看得到的(已上架 + 核准 + 公開)
      sb.from("stays").select("id, slug, updated_at, region, category").eq("published", true).eq("approved", true).eq("visibility", "published").limit(5000),
      sb.from("trips").select("id, slug, updated_at").eq("is_public", true).limit(5000),
    ]);
    const stayRoutes: MetadataRoute.Sitemap = (stays || []).map((s: { id: string; slug?: string; updated_at?: string }) => ({
      url: `${BASE}/stay/${encodeURIComponent(s.slug || s.id)}`, lastModified: s.updated_at ? new Date(s.updated_at) : now, changeFrequency: "weekly", priority: 0.8,
    }));
    const tripRoutes: MetadataRoute.Sitemap = (trips || []).map((t: { id: string; slug?: string; updated_at?: string }) => ({
      url: `${BASE}/trips/${encodeURIComponent(t.slug || t.id)}`, lastModified: t.updated_at ? new Date(t.updated_at) : now, changeFrequency: "weekly", priority: 0.6,
    }));
    // 地區落地頁:只收錄真的有民宿的地區(避免薄頁)
    const rows = (stays || []) as { region?: string; category?: string }[];
    const regions = Array.from(new Set(rows.map((s) => s.region).filter(Boolean))) as string[];
    const regionRoutes: MetadataRoute.Sitemap = regions.map((r) => ({
      url: `${BASE}/stays/${encodeURIComponent(r)}`, lastModified: now, changeFrequency: "daily", priority: 0.9,
    }));
    // 主題頁:只收錄「真的有該組合」且「風格是有效主題」的頁(排除一般民宿等沒有主題頁的)
    const themeCats = new Set(STAY_THEMES.map((t) => t.cat));
    const combos = Array.from(new Set(rows.filter((s) => s.region && s.category && themeCats.has(s.category)).map((s) => `${s.region}|${s.category}`)));
    const themeRoutes: MetadataRoute.Sitemap = combos.map((c) => {
      const [r, cat] = c.split("|");
      return { url: `${BASE}/stays/${encodeURIComponent(r)}/${encodeURIComponent(cat)}`, lastModified: now, changeFrequency: "daily", priority: 0.85 };
    });
    return [...staticRoutes, ...regionRoutes, ...themeRoutes, ...stayRoutes, ...tripRoutes];
  } catch {
    return staticRoutes;
  }
}
