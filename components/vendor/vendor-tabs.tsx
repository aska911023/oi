"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 業者後台兩層導覽:頂層「我的民宿 / 我的租車」;「訂房」收進「我的民宿」底下的子層。
const TOP = [
  { href: "/vendor", label: "我的民宿", inSection: (p: string) => p === "/vendor" || p.startsWith("/vendor/bookings") },
  { href: "/vendor/rentals", label: "我的租車", inSection: (p: string) => p.startsWith("/vendor/rentals") },
  { href: "/vendor/partnerships", label: "異業合作", inSection: (p: string) => p.startsWith("/vendor/partnerships") },
];
const STAY_SUB = [
  { href: "/vendor", label: "民宿資料", exact: true },
  { href: "/vendor/bookings", label: "訂房管理", exact: false },
];

export default function VendorTabs() {
  const path = usePathname();
  const inStay = path === "/vendor" || path.startsWith("/vendor/bookings");
  return (
    <>
      <nav className="admin-tabs">
        {TOP.map((t) => (
          <Link key={t.href} href={t.href} className={t.inSection(path) ? "on" : ""}>{t.label}</Link>
        ))}
      </nav>
      {inStay && (
        <nav className="admin-tabs" style={{ marginTop: 6, fontSize: 14, opacity: 0.95 }}>
          {STAY_SUB.map((s) => {
            const on = s.exact ? path === s.href : path.startsWith(s.href);
            return <Link key={s.href} href={s.href} className={on ? "on" : ""}>{s.label}</Link>;
          })}
        </nav>
      )}
    </>
  );
}
