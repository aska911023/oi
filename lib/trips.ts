import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import type { Trip } from "./types";

// 公開行程牆第一頁 + 總數。公開資料 → 跨請求快取(tag: trips)。
export const getTripsInitial = unstable_cache(async (): Promise<{ trips: Trip[]; total: number }> => {
  if (!hasSupabase()) return { trips: [], total: 0 };
  try {
    const sb = createPublicClient();
    const { data } = await sb.rpc("search_trips", { lim: 24, off: 0 });
    return { trips: (data?.rows || []) as Trip[], total: data?.total ?? 0 };
  } catch {
    return { trips: [], total: 0 };
  }
}, ["trips-initial"], { tags: ["trips"], revalidate: 120 });
