"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ViewRole } from "@/lib/viewer";

// admin 專用:以某個角色「預覽」網站(像 Discord 以身分查看)。
// 靠 cookie oi_view_as 讓伺服器端的 header/頁面跟著變;只改畫面,不改資料權限。
const LABEL: Record<string, string> = { partner: "業者", user: "一般會員", guest: "訪客" };
const OPTIONS: { v: ViewRole | "self"; label: string }[] = [
  { v: "self", label: "以自己(管理員)" },
  { v: "partner", label: "業者" },
  { v: "user", label: "一般會員" },
  { v: "guest", label: "訪客(未登入)" },
];

export default function RoleViewSwitcher({ isRealAdmin, viewAs, compact = false }: { isRealAdmin: boolean; viewAs: ViewRole | null; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!isRealAdmin) return null;

  function pick(v: ViewRole | "self") {
    setOpen(false);
    // 用整頁跳轉(非 router.push)—— cookie 影響的是伺服器端渲染,整頁導航才會重讀 cookie、確實套上角色
    if (v === "self") {
      document.cookie = "oi_view_as=; path=/; max-age=0";
      window.location.href = "/admin"; // 結束預覽 → 回總後台
    } else {
      document.cookie = `oi_view_as=${v}; path=/; max-age=86400`;
      window.location.href = "/"; // 選了角色 → 前台首頁(確實套上)
    }
  }

  // 前台只在「預覽中」顯示一條結束列(切換鈕本體收在後台)
  if (compact) {
    if (!viewAs) return null;
    return (
      <div className="roleview-banner">
        <span>👁 以「{LABEL[viewAs]}」身分檢視中</span>
        <button onClick={() => pick("self")}>結束預覽</button>
      </div>
    );
  }

  return (
    <div className={"roleview" + (viewAs ? " active" : "")}>
      {open && <div className="roleview-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="roleview-menu">
          <div className="roleview-h">以哪個身分檢視網站</div>
          {OPTIONS.map((o) => (
            <button key={o.v} className={viewAs === o.v || (o.v === "self" && !viewAs) ? "on" : ""} onClick={() => pick(o.v)}>{o.label}</button>
          ))}
          <div className="roleview-note">只改畫面,不改資料權限</div>
        </div>
      )}
      <button className="roleview-btn" onClick={() => setOpen((o) => !o)}>
        👁 {viewAs ? `檢視中:${LABEL[viewAs]}` : "檢視身分"}
      </button>
      {viewAs && <button className="roleview-exit" onClick={() => pick("self")} title="結束預覽">✕</button>}
    </div>
  );
}
