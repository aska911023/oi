import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import type { RoomCard } from "./types";

const PAGE = 24;

// 前台首頁:房型商品卡第一頁 + 總數 + 地區清單。tag 用 stays(房型存檔會 revalidate stays)。
export const getRoomsInitial = unstable_cache(async (): Promise<{ rooms: RoomCard[]; total: number; regions: string[] }> => {
  if (!hasSupabase()) return { rooms: [], total: 0, regions: [] };
  try {
    const sb = createPublicClient();
    const { data } = await sb.rpc("search_rooms", { lim: PAGE, off: 0 });
    const total: number = data?.total ?? 0;
    let regions: string[] = [];
    if (total) {
      const { data: rg } = await sb.from("stays").select("region").eq("published", true).eq("visibility", "published");
      regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region)));
    }
    return { rooms: (data?.rows || []) as RoomCard[], total, regions };
  } catch {
    return { rooms: [], total: 0, regions: [] };
  }
}, ["rooms-initial"], { tags: ["stays"], revalidate: 120 });
