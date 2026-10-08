"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// 換頁時強制捲回頁頂(html 有 scroll-behavior:smooth 會讓 Next 預設的回頂失效/卡住,這裡用 instant 蓋過)。
export default function ScrollTop() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
