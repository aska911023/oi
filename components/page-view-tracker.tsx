"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 全站瀏覽埋點(靜默):每次換頁記一次,來源靠 referrer 在後端分類(搜尋/社群/其他/直接)。
// 後台/個人頁不記(RPC 內也會再擋一次)。給 /admin/analytics 的「流量總覽」用。
function sessionId(): string | null {
  try {
    let s = sessionStorage.getItem("oi_sid");
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("oi_sid", s);
    }
    return s;
  } catch {
    return null;
  }
}

export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || /^\/(admin|vendor|account|me|login)/.test(pathname)) return;
    const sb = createClient();
    sb.rpc("log_page_view", { p_path: pathname, p_ref: document.referrer || "", p_session: sessionId() })
      .then(() => {}, () => {});
  }, [pathname]);
  return null;
}
