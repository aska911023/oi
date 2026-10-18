"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";

// 外連按鈕(純連結,無導流追蹤):未登入點擊 → 擋登入跳彈窗。
// 給租車等「聯絡/預約」連結用;載入中(undefined)放行,避免誤擋已登入者。
export default function GatedOutLink({ href, className, title, desc, children }: {
  href: string; className?: string; title?: string; desc?: string; children: React.ReactNode;
}) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    createClient().auth.getUser().then(({ data }) => { if (alive) setUid(data.user?.id ?? null); });
    return () => { alive = false; };
  }, []);

  function onClick(e: React.MouseEvent) {
    if (uid === null) {
      e.preventDefault();
      promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", { title: title || "加入會員", desc });
    }
  }

  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {children}
    </a>
  );
}
