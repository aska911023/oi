"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";

// entity 頁的「加入行程」:要登入才能用(行程是會員功能);登入後寫進 localStorage 草稿,/plan 自動帶入。
const KEY = "oi_trip_draft";
type TripDraftType = "stay" | "attraction" | "food" | "parking" | "rental" | "station";
type DraftItem = { type: TripDraftType; refId: string; name: string; region?: string };

export default function AddToTrip({ type, refId, name, region, compact = false }: DraftItem & { compact?: boolean }) {
  const [added, setAdded] = useState(false);
  const [uid, setUid] = useState<string | null | undefined>(undefined); // undefined=載入中

  useEffect(() => {
    let alive = true;
    createClient().auth.getUser().then(({ data }) => { if (alive) setUid(data.user?.id ?? null); });
    return () => { alive = false; };
  }, []);

  function add() {
    if (uid === null) {
      promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", {
        title: "加入會員規劃行程",
        desc: "登入後即可把喜歡的民宿、景點加進你的專屬行程。",
      });
      return;
    }
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
        {added ? "✓" : "＋"}
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
