import { permanentRedirect, notFound } from "next/navigation";
import { isCity } from "@/lib/city";
import { decodeParam } from "@/lib/slug";

export const dynamic = "force-dynamic";

// 舊地區落地頁 → 城市優先新結構(308 永久轉址,保 SEO)。
// /stays/{area} → /{area}/hotels
export default async function LegacyRegionStays({ params }: { params: Promise<{ area: string }> }) {
  const region = decodeParam((await params).area);
  if (!isCity(region)) notFound();
  permanentRedirect(`/${encodeURIComponent(region)}/hotels`);
}
