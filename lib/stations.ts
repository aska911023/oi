import { unstable_cache } from "next/cache";
import { hasSupabase } from "./stays";
import { createPublicClient } from "./supabase/public";
import { sbRetry } from "./retry";
import type { Station } from "./types";

// 車站清單(高鐵 + 台鐵),參考資料、跨請求快取。
export const getStations = unstable_cache(async (): Promise<Station[]> => {
  if (!hasSupabase()) return [];
  const sb = createPublicClient();
  // 失敗重試、失敗不快取空值(原本 catch 回空會被快取卡 1 小時)
  const { data } = await sbRetry<Station[]>(() => sb.from("stations").select("*").order("sort"), "stations");
  return data;
}, ["stations"], { tags: ["stations"], revalidate: 3600 });
