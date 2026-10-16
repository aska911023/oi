"use client";

import { useViewer } from "@/lib/use-viewer-client";

// 前台「以某角色檢視中」的結束列(client,取代原本靠伺服器端 viewer 的 RoleViewSwitcher compact)。
const LABEL: Record<string, string> = { partner: "業者", creator: "創作者", user: "一般會員", guest: "訪客" };

export default function RolePreviewBanner() {
  const { isRealAdmin, viewAs } = useViewer();
  if (!isRealAdmin || !viewAs) return null;

  function end() {
    document.cookie = "oi_view_as=; path=/; max-age=0";
    window.location.href = "/admin"; // 整頁導航,結束預覽
  }

  return (
    <div className="roleview-banner">
      <span>👁 以「{LABEL[viewAs] || viewAs}」身分檢視中</span>
      <button onClick={end}>結束預覽</button>
    </div>
  );
}
