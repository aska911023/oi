"use client";

import { useEffect } from "react";

// 前台任一頁伺服器端載入失敗(例如 Supabase 暫時抖動)時顯示這頁,
// 並自動重試。因為失敗不再被寫進快取,重試通常馬上就恢復 —— 不會再整片空白卡住。
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => reset(), 2500);
    return () => clearTimeout(t);
  }, [reset]);

  return (
    <main className="shell" style={{ paddingTop: 140, paddingBottom: 80, textAlign: "center" }}>
      <h1 className="serif" style={{ marginBottom: 10 }}>內容載入中…</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>
        連線暫時忙碌,正在自動重新載入。若畫面沒有恢復,請
        <button className="lnk" onClick={() => reset()} style={{ margin: "0 4px" }}>點此重試</button>
        或重新整理頁面。
      </p>
      <button className="btn btn-primary" onClick={() => reset()}>重新載入</button>
    </main>
  );
}
