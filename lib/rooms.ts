import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import { sbRetry } from "./retry";
import type { RoomCard } from "./types";

const PAGE = 24;

// 地區落地頁(/stays/[area])用:某地區已上架民宿房型卡 + 總數。
export function getRoomsByRegion(region: string) {
  return unstable_cache(async (): Promise<{ rooms: RoomCard[]; total: number }> => {
    if (!hasSupabase()) return { rooms: [], total: 0 };
    const sb = createPublicClient();
    const { data } = await sbRetry<{ total?: number; rows?: RoomCard[] }>(
      () => sb.rpc("search_rooms", { p_region: region, lim: 48, off: 0 }),
      "search_rooms:" + region,
    );
    return { rooms: (data.rows || []) as RoomCard[], total: data.total ?? 0 };
  }, ["rooms-by-region", region], { tags: ["stays"], revalidate: 300 })();
}

// 前台首頁:房型商品卡第一頁 + 總數 + 地區清單。tag 用 stays(房型存檔會 revalidate stays)。
export const getRoomsInitial = unstable_cache(async (): Promise<{ rooms: RoomCard[]; total: number; regions: string[]; categories: string[] }> => {
  if (!hasSupabase()) return { rooms: [], total: 0, regions: [], categories: [] };
  const sb = createPublicClient();

  // 重試暫時性失敗;三次都失敗就 throw —— 絕不把「空結果」當成功值快取,
  // 否則一次連線抖動就會讓整個首頁空白並卡住 120 秒(= 之前「常常資料都沒了」的真因)。
  let data: { total?: number; rows?: RoomCard[] } | null = null;
  let lastErr: unknown = null;
  for (let i = 0; i < 3; i++) {
    const res = await sb.rpc("search_rooms", { lim: PAGE, off: 0 });
    if (!res.error && res.data) { data = res.data as { total?: number; rows?: RoomCard[] }; break; }
    lastErr = res.error;
    await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  if (!data) throw new Error("search_rooms 連續失敗:" + (lastErr instanceof Error ? lastErr.message : JSON.stringify(lastErr)));

  const total: number = data.total ?? 0;
  let regions: string[] = [];
  let categories: string[] = [];
  if (total) {
    // 只取「真的有上架房型」的民宿之地區/風格,前台篩選才不會列出空的選項
    const { data: rg } = await sb.from("stays").select("region, category").eq("published", true).eq("visibility", "published").eq("approved", true);
    regions = Array.from(new Set((rg || []).map((r: { region: string }) => r.region))).filter(Boolean) as string[];
    categories = Array.from(new Set((rg || []).map((r: { category: string }) => r.category))).filter(Boolean) as string[];
  }
  return { rooms: (data.rows || []) as RoomCard[], total, regions, categories };
}, ["rooms-initial"], { tags: ["stays"], revalidate: 120 });
