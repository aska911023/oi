"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";

// 外連按鈕:點擊時記事件(導流數據),導向商家網頁時可自動帶 UTM 來源參數。
// 聯絡/訂房類型(官網、LINE)要登入才能用 → 擋登入跳彈窗(地圖/導航不擋)。
function withUtm(href: string) {
  try {
    const u = new URL(href);
    u.searchParams.set("utm_source", "ousu");
    u.searchParams.set("utm_medium", "referral");
    return u.toString();
  } catch { return href; }
}

const GATED = new Set(["click_website", "click_line"]); // 要登入的聯絡/訂房動作

export default function OutboundLink({ href, type, stayId, utm = false, className, children }: {
  href: string; type: string; stayId?: string; utm?: boolean; className?: string; children: React.ReactNode;
}) {
  const url = utm ? withUtm(href) : href;
  const [uid, setUid] = useState<string | null | undefined>(undefined); // undefined=載入中

  useEffect(() => {
    let alive = true;
    createClient().auth.getUser().then(({ data }) => { if (alive) setUid(data.user?.id ?? null); });
    return () => { alive = false; };
  }, []);

  function onClick(e: React.MouseEvent) {
    track(type, { stayId, meta: { href } });
    if (GATED.has(type) && uid === null) {
      e.preventDefault();
      promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", {
        title: "加入會員聯絡民宿",
        desc: "登入後即可取得民宿的官方訂房管道與聯絡方式。",
      });
    }
  }

  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {children}
    </a>
  );
}
