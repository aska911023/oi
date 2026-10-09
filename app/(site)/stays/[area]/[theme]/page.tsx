import { permanentRedirect, notFound } from "next/navigation";
import { isCity } from "@/lib/city";
import { STAY_THEMES } from "@/lib/rooms";
import { decodeParam } from "@/lib/slug";

export const dynamic = "force-dynamic";

// 舊地區×主題頁 → 新結構(308)。
// /stays/{area}/{theme} → /{area}/hotels/{theme}(主題無效則退回 /{area}/hotels)
export default async function LegacyRegionThemeStays({ params }: { params: Promise<{ area: string; theme: string }> }) {
  const { area, theme } = await params;
  const region = decodeParam(area);
  if (!isCity(region)) notFound();
  const cat = decodeParam(theme);
  const valid = STAY_THEMES.some((t) => t.cat === cat);
  permanentRedirect(valid ? `/${encodeURIComponent(region)}/hotels/${encodeURIComponent(cat)}` : `/${encodeURIComponent(region)}/hotels`);
}
