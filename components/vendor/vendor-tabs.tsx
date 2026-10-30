"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POI_KINDS } from "@/lib/types";

// 業者後台兩層導覽:
//  頂層「我的民宿 / 我的據點 / 我的租車 / 異業合作」;
//  「訂房」收進「我的民宿」底下;景點/餐廳/娛樂/外燴/停車 收進「我的據點」底下。
const TOP = [
  { href: "/vendor", label: "我的民宿", inSection: (p: string) => p === "/vendor" || p.startsWith("/vendor/bookings") },
  { href: "/vendor/places", label: "我的據點", inSection: (p: string) => p.startsWith("/vendor/places") },
  { href: "/vendor/rentals", label: "我的租車", inSection: (p: string) => p.startsWith("/vendor/rentals") },
  { href: "/vendor/partnerships", label: "異業合作", inSection: (p: string) => p.startsWith("/vendor/partnerships") },
];
const STAY_SUB = [
  { href: "/vendor", label: "民宿資料", exact: true },
  { href: "/vendor/bookings", label: "訂房管理", exact: false },
];
const PLACE_SUB = POI_KINDS.map((k) => ({ href: `/vendor/places/${k.slug}`, label: k.label }));

export default function VendorTabs() {
  const path = usePathname();
  const inStay = path === "/vendor" || path.startsWith("/vendor/bookings");
  const inPlaces = path.startsWith("/vendor/places");
  const sub = inStay ? STAY_SUB.map((s) => ({ ...s })) : inPlaces ? PLACE_SUB.map((s) => ({ ...s, exact: false })) : null;
  return (
    <>
      <nav className="admin-tabs">
        {TOP.map((t) => (
          <Link key={t.href} href={t.href} className={t.inSection(path) ? "on" : ""}>{t.label}</Link>
        ))}
      </nav>
      {sub && (
        <nav className="admin-tabs" style={{ marginTop: 6, fontSize: 14, opacity: 0.95 }}>
          {sub.map((s) => {
            const on = s.exact ? path === s.href : path === s.href || path.startsWith(s.href + "/");
            return <Link key={s.href} href={s.href} className={on ? "on" : ""}>{s.label}</Link>;
          })}
        </nav>
      )}
    </>
  );
}
