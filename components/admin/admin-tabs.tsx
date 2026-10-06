"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 「旅遊上架」底下的分頁(民宿 + 探索景點三類 + 租車)
const GROUP = [
  { href: "/admin", label: "民宿" },
  { href: "/admin/places/attraction", label: "景點" },
  { href: "/admin/places/food", label: "美食" },
  { href: "/admin/places/parking", label: "停車" },
  { href: "/admin/rentals", label: "租車" },
];

// 頂層大標
const TOP = [
  { href: "/admin", label: "旅遊上架", group: true },
  { href: "/admin/members", label: "會員資料" },
  { href: "/admin/vendors", label: "業者審核" },
  { href: "/admin/partners", label: "業者名單" },
  { href: "/admin/site", label: "首頁設定" },
  { href: "/admin/analytics", label: "數據" },
];

export default function AdminTabs() {
  const path = usePathname();
  const inGroup =
    path === "/admin" || path.startsWith("/admin/places") || path.startsWith("/admin/rentals");

  return (
    <>
      <nav className="admin-tabs">
        {TOP.map((t) => {
          const on = t.group ? inGroup : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={on ? "on" : ""}>{t.label}</Link>
          );
        })}
      </nav>
      {inGroup && (
        <nav className="admin-subtabs">
          {GROUP.map((t) => {
            const on = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={on ? "on" : ""}>{t.label}</Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
