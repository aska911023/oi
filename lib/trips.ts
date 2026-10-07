import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import { sbRetry } from "./retry";
import type { Trip } from "./types";

// 公開行程牆第一頁 + 總數。公開資料 → 跨請求快取(tag: trips)。
export const getTripsInitial = unstable_cache(async (): Promise<{ trips: Trip[]; total: number }> => {
  if (!hasSupabase()) return { trips: [], total: 0 };
  const sb = createPublicClient();
  // 失敗重試、失敗不快取空值(見 lib/retry.ts)
  const { data } = await sbRetry<{ total?: number; rows?: Trip[] }>(() => sb.rpc("search_trips", { lim: 24, off: 0 }), "search_trips");
  return { trips: (data.rows || []) as Trip[], total: data.total ?? 0 };
}, ["trips-initial"], { tags: ["trips"], revalidate: 120 });
