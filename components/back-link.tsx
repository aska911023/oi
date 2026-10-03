"use client";

import { useRouter } from "next/navigation";

// 用瀏覽器上一頁返回(保留捲動位置與篩選狀態,不刷新);無歷史時退回 fallback。
export default function BackLink({ fallback = "/", label = "← 回探索" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button className="lnk" onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push(fallback); }}>
      {label}
    </button>
  );
}
