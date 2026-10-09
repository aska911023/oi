"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 手機 app 式底部導航(桌機隱藏)。對應既有路由。
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "首頁", icon: <svg viewBox="0 0 24 24" {...S}><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg> },
  { href: "/places/attraction", label: "探索", icon: <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg> },
  { href: "/search", label: "搜尋", icon: <svg viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg> },
  { href: "/me/saved", label: "收藏", icon: <svg viewBox="0 0 24 24" {...S}><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg> },
  { href: "/account", label: "我的", icon: <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg> },
];

export default function BottomNav() {
  const path = usePathname() || "/";
  const isActive = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <nav className="bottomnav" aria-label="主導航">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className={"bn-item" + (isActive(it.href) ? " on" : "")}>
          <span className="bn-ic">{it.icon}</span>
          <span className="bn-lb">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
