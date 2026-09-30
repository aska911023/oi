"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/vendor", label: "我的民宿" },
  { href: "/vendor/rentals", label: "我的租車" },
];

export default function VendorTabs() {
  const path = usePathname();
  return (
    <nav className="admin-tabs">
      {TABS.map((t) => {
        const on = t.href === "/vendor" ? path === "/vendor" : path.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={on ? "on" : ""}>{t.label}</Link>;
      })}
    </nav>
  );
}
