import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import type { RoomCard } from "./types";

const PAGE = 24;

// 前台首頁:房型商品卡第一頁 + 總數 + 地區清單。tag 用 stays(房型存檔會 revalidate stays)。
export const getRoomsInitial = unstable_cache(async (): Promise<{ rooms: RoomCard[]; total: number; regions: string[]; categories: string[] }> => {
  if (!hasSupabase()) return { rooms: [], total: 0, regions: [], categories: [] };
  try {
    const sb = createPublicClient();
    const { data } = await sb.rpc("search_rooms", { lim: PAGE, off: 0 });
    const total: number = data?.total ?? 0;
    let regions: string[] = [];
    let categories: string[] = [];
    if (total) {
      // 只取「真的有上架房型」的民宿之地區/風格,前台篩選才不會列出空的選項
      const { data: rg } = await sb.from("stays").select("region, category").eq("published", true).eq("visibility", "published").eq("approved", true);
      regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region))).filter(Boolean) as string[];
      categories = Array.from(new Set((rg || []).map((r: { category: string }) => r.category))).filter(Boolean) as string[];
    }
    return { rooms: (data?.rows || []) as RoomCard[], total, regions, categories };
  } catch {
    return { rooms: [], total: 0, regions: [], categories: [] };
  }
}, ["rooms-initial"], { tags: ["stays"], revalidate: 120 });
