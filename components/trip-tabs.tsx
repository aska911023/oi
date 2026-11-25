"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 「行程」區段的切換條:規劃行程(/plan)↔ 行程分享(/trips)。兩頁共用,讓兩個功能住在同一入口下。
const TABS = [
  { href: "/plan", label: "規劃行程" },
  { href: "/trips", label: "行程分享" },
];

export default function TripTabs() {
  const path = usePathname() || "";
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg-2, #eef1ef)", borderRadius: 999, marginBottom: 16 }}>
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            style={{
              padding: "7px 20px",
              borderRadius: 999,
              fontSize: 14.5,
              fontWeight: 600,
              textDecoration: "none",
              color: on ? "#fff" : "var(--text-2, #5d706a)",
              background: on ? "var(--green, #17635a)" : "transparent",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
