import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import type { RentalShop } from "./types";

// 給行程規劃器用:全部已上架租車店(名稱/地區)
export async function getPublishedRentalShops(): Promise<RentalShop[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("rental_shops").select("*").eq("published", true).order("created_at", { ascending: false });
    return (data || []) as RentalShop[];
  } catch {
    return [];
  }
}

// 前台租車:第一頁(RPC 分頁)+ 總數 + 地區清單。公開資料 → 跨請求快取(tag: rentals)。
export const getRentalsInitial = unstable_cache(async (): Promise<{ shops: RentalShop[]; total: number; regions: string[] }> => {
  if (!hasSupabase()) return { shops: [], total: 0, regions: [] };
  try {
    const sb = createPublicClient();
    const { data } = await sb.rpc("search_rentals", { lim: 24, off: 0 });
    const total: number = data?.total ?? 0;
    let regions: string[] = [];
    if (total) {
      const { data: rg } = await sb.from("rental_shops").select("region").eq("published", true);
      regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region)));
    }
    return { shops: (data?.rows || []) as RentalShop[], total, regions };
  } catch {
    return { shops: [], total: 0, regions: [] };
  }
}, ["rentals-initial"], { tags: ["rentals"], revalidate: 120 });
