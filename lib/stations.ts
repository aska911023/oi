import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import type { Station } from "./types";

// 車站清單(高鐵 + 台鐵),參考資料、跨請求快取。
export const getStations = unstable_cache(async (): Promise<Station[]> => {
  if (!hasSupabase()) return [];
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("stations").select("*").order("sort");
    return (data || []) as Station[];
  } catch {
    return [];
  }
}, ["stations"], { tags: ["stations"], revalidate: 3600 });
