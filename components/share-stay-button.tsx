"use client";

import { track } from "@/lib/track";

// 分享民宿:記 click_share 事件(進後台數據),再用系統分享或複製當前頁網址。
export default function ShareStayButton({ stayId, name }: { stayId: string; name: string }) {
  async function share(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    track("click_share", { stayId });
    const url = typeof window !== "undefined" ? window.location.href : "";
    const data = { title: name, text: name, url };
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(data); return; } catch { return; }
    }
    try { await navigator.clipboard.writeText(`${name}\n${url}`); alert("連結已複製:\n" + name); }
    catch { prompt("複製分享:", url); }
  }
  return (
    <button className="btn btn-ghost" onClick={share} aria-label="分享">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "-3px" }}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" /></svg>
      分享
    </button>
  );
}
