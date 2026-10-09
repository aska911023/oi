"use client";

import { useState } from "react";

// entity 頁的「加入行程」:寫進 localStorage 草稿,/plan 開新行程時自動帶入。
// 不需登入也能先丟進草稿;到規劃頁再整理/存檔。
const KEY = "oi_trip_draft";
type DraftItem = { type: "stay" | "attraction" | "food" | "parking"; refId: string; name: string; region?: string };

export default function AddToTrip({ type, refId, name, region }: DraftItem) {
  const [added, setAdded] = useState(false);

  function add() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr: DraftItem[] = raw ? JSON.parse(raw) : [];
      if (!arr.some((x) => x.refId === refId && x.type === type)) arr.push({ type, refId, name, region });
      localStorage.setItem(KEY, JSON.stringify(arr));
      setAdded(true);
    } catch { /* ignore */ }
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
