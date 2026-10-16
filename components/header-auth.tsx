"use client";

import Link from "next/link";
import NotificationBell from "@/components/notification-bell";
import Avatar from "@/components/avatar";
import { useViewer } from "@/lib/use-viewer-client";

// header 右側的「登入狀態」區塊(client)。抽成島,讓 header 其餘(logo/搜尋/導覽)維持靜態。
export default function HeaderAuth() {
  const { loading, loggedIn, role, name, avatarUrl } = useViewer();
  if (loading) return null; // 解析登入前先不顯示,避免閃錯內容

  if (!loggedIn) return <Link href="/login" className="cta">登入 / 註冊</Link>;

  return (
    <>
      {(role === "partner" || role === "admin") && <Link href="/vendor">業者後台</Link>}
      {role === "admin" && <Link href="/admin">管理後台</Link>}
      <NotificationBell />
      <Link href="/me/trips" className="cta cta-user"><Avatar src={avatarUrl} name={name} size={30} /> 歡迎,{name}</Link>
    </>
  );
}
