"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// 進入民宿頁時記一次瀏覽
export default function TrackView({ stayId }: { stayId: string }) {
  useEffect(() => { track("stay_view", { stayId }); }, [stayId]);
  return null;
}
