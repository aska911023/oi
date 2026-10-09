"use client";

import { useState } from "react";

// entity 頁的「加入行程」:寫進 localStorage 草稿,/plan 開新行程時自動帶入。
// 不需登入也能先丟進草稿;到規劃頁再整理/存檔。
const KEY = "oi_trip_draft";
type TripDraftType = "stay" | "attraction" | "food" | "parking" | "rental" | "station";
type DraftItem = { type: TripDraftType; refId: string; name: string; region?: string };

export default function AddToTrip({ type, refId, name, region, compact = false }: DraftItem & { compact?: boolean }) {
  const [added, setAdded] = useState(false);

  function add() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr: DraftItem[] = raw ? JSON.parse(raw) : [];
      if (!arr.some((x) => x.refId === refId && x.type === type)) arr.push({ type, refId, name, region });
      localStorage.setItem(KEY, JSON.stringify(arr));
      window.dispatchEvent(new Event("oi-trip-draft")); // 通知浮動草稿籃更新
      setAdded(true);
    } catch { /* ignore */ }
  }

  if (compact) {
    return (
      <button type="button" className={"att-compact" + (added ? " on" : "")} onClick={add} disabled={added}
        title={added ? "已加入行程" : "加入行程"} aria-label={added ? "已加入行程" : "加入行程"}>
        {added ? "✓" : "＋ 行程"}
      </button>
    );
  }

  return (
    <span className="att-wrap">
      <button type="button" className="btn btn-ghost" onClick={add} disabled={added} title="加入行程草稿,到「我的旅程/規劃」整理">
        {added ? "已加入行程 ✓" : "＋ 加入行程"}
      </button>
      {added && <a className="lnk" href="/plan" style={{ marginLeft: 8 }}>去規劃 →</a>}
    </span>
  );
}
