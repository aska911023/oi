"use client";

import { useEffect, useState } from "react";
import { useCompare } from "@/lib/compare-store";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";
import type { RoomCard } from "@/lib/types";

// 卡片上的「加入比較」浮鈕(疊在收藏書籤下方)。加入比較要登入(會員功能);移除不擋。
export default function CompareToggle({ card }: { card: RoomCard }) {
  const { has, toggle, items, max } = useCompare();
  const [uid, setUid] = useState<string | null | undefined>(undefined); // undefined=載入中

  useEffect(() => {
    let alive = true;
    createClient().auth.getSession().then(({ data }) => { if (alive) setUid(data.session?.user?.id ?? null); });
    return () => { alive = false; };
  }, []);

  const on = has(card.id);
  const full = !on && items.length >= max;

  function onClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!on && uid === null) {
      promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", {
        title: "加入會員比較民宿",
        desc: "登入後即可把心動的民宿加入比較,並排一次看。",
      });
      return;
    }
    toggle(card);
  }

  return (
    <button className={"compare-toggle float" + (on ? " on" : "")} disabled={full}
      title={on ? "已加入比較" : full ? `最多比較 ${max} 間` : "加入比較"} aria-label="加入比較"
      onClick={onClick}>
      {on ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h12l-3-3M21 17H9l3 3" /></svg>
      )}
    </button>
  );
}
