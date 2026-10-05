"use client";

import { useCompare } from "@/lib/compare-store";
import type { RoomCard } from "@/lib/types";

// 卡片上的「加入比較」浮鈕(疊在收藏書籤下方)
export default function CompareToggle({ card }: { card: RoomCard }) {
  const { has, toggle, items, max } = useCompare();
  const on = has(card.id);
  const full = !on && items.length >= max;
  return (
    <button className={"compare-toggle float" + (on ? " on" : "")} disabled={full}
      title={on ? "已加入比較" : full ? `最多比較 ${max} 間` : "加入比較"} aria-label="加入比較"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(card); }}>
      {on ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h12l-3-3M21 17H9l3 3" /></svg>
      )}
    </button>
  );
}
