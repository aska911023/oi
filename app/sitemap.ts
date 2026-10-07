import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

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
      sb.from("stays").select("id, updated_at").eq("published", true).eq("approved", true).eq("visibility", "published").limit(5000),
      sb.from("trips").select("id, updated_at").eq("is_public", true).limit(5000),
    ]);
    const stayRoutes: MetadataRoute.Sitemap = (stays || []).map((s: { id: string; updated_at?: string }) => ({
      url: `${BASE}/stay/${s.id}`, lastModified: s.updated_at ? new Date(s.updated_at) : now, changeFrequency: "weekly", priority: 0.8,
    }));
    const tripRoutes: MetadataRoute.Sitemap = (trips || []).map((t: { id: string; updated_at?: string }) => ({
      url: `${BASE}/trips/${t.id}`, lastModified: t.updated_at ? new Date(t.updated_at) : now, changeFrequency: "weekly", priority: 0.6,
    }));
    return [...staticRoutes, ...stayRoutes, ...tripRoutes];
  } catch {
    return staticRoutes;
  }
}
