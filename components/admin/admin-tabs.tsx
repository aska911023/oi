"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "民宿管理" },
  { href: "/admin/places/attraction", label: "景點" },
  { href: "/admin/places/food", label: "美食" },
  { href: "/admin/places/parking", label: "停車" },
  { href: "/admin/rentals", label: "租車" },
  { href: "/admin/members", label: "會員" },
  { href: "/admin/vendors", label: "業者審核" },
  { href: "/admin/site", label: "首頁設定" },
  { href: "/admin/analytics", label: "數據" },
];

export default function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="admin-tabs">
      {TABS.map((t) => {
        const on = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""}>{t.label}</Link>
        );
      })}
    </nav>
  );
}
