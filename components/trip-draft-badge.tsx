"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// 浮動「行程草稿籃」:顯示 localStorage 草稿目前收集幾個,點了去 /plan。
// 透過自訂事件 oi-trip-draft 即時更新(AddToTrip 寫入時 / TripPlanner 帶入清空時都會發)。
const KEY = "oi_trip_draft";
function readCount(): number {
  try { const raw = localStorage.getItem(KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a.length : 0; } catch { return 0; }
}

export default function TripDraftBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const update = () => setN(readCount());
    update();
    window.addEventListener("oi-trip-draft", update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("oi-trip-draft", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  if (n <= 0) return null;

  function clear(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    window.dispatchEvent(new Event("oi-trip-draft"));
  }

  return (
    <Link href="/plan" className="tripdraft" title="去規劃行程">
      <span className="td-ic" aria-hidden="true">🧳</span>
      <span className="td-tx">行程草稿</span>
      <span className="td-n">{n}</span>
      <button type="button" className="td-x" onClick={clear} aria-label="清空草稿">✕</button>
    </Link>
  );
}
