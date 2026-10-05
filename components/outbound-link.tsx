"use client";

import { track } from "@/lib/track";

// 外連按鈕:點擊時記事件(導流數據),導向商家網頁時可自動帶 UTM 來源參數。
function withUtm(href: string) {
  try {
    const u = new URL(href);
    u.searchParams.set("utm_source", "ousu");
    u.searchParams.set("utm_medium", "referral");
    return u.toString();
  } catch { return href; }
}

export default function OutboundLink({ href, type, stayId, utm = false, className, children }: {
  href: string; type: string; stayId?: string; utm?: boolean; className?: string; children: React.ReactNode;
}) {
  const url = utm ? withUtm(href) : href;
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer"
      onClick={() => track(type, { stayId, meta: { href } })}>
      {children}
    </a>
  );
}
