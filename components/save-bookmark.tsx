"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";

export type SaveType = "stay" | "room" | "attraction" | "food" | "parking" | "rental" | "station" | "activity" | "catering";

// 書籤收藏 icon。type=stay 用 saved 表;其餘用 saved_places(kind+place_id)。
// floating=true 時浮在圖片右上角。
// onToggle:收藏成功後回報新狀態,讓外層(例如房型卡的「N 人收藏」)能當場更新數字,
// 不必等伺服器快取過期。
export default function SaveBookmark({ type, id, floating = false, nextPath = "/", onToggle }: {
  type: SaveType; id: string; floating?: boolean; nextPath?: string; onToggle?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const user = session?.user ?? null;
      if (!user || !alive) return;
      setUid(user.id);
      const q = type === "stay"
        ? sb.from("saved").select("stay_id").eq("user_id", user.id).eq("stay_id", id)
        : sb.from("saved_places").select("place_id").eq("user_id", user.id).eq("kind", type).eq("place_id", id);
      const { data } = await q.maybeSingle();
      if (alive) setSaved(!!data);
    })();
    return () => { alive = false; };
  }, [type, id]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!uid) { promptLogin(nextPath, { title: "收藏喜歡的民宿", desc: "加入會員,把心動的民宿收藏起來,下次直接找得到。" }); return; }
    setBusy(true);
    const sb = createClient();
    if (type === "stay") {
      if (saved) await sb.from("saved").delete().eq("user_id", uid).eq("stay_id", id);
      else await sb.from("saved").insert({ user_id: uid, stay_id: id });
    } else {
      if (saved) await sb.from("saved_places").delete().eq("user_id", uid).eq("kind", type).eq("place_id", id);
      else await sb.from("saved_places").insert({ user_id: uid, kind: type, place_id: id });
    }
    setSaved(!saved);
    setBusy(false);
    onToggle?.(!saved);   // 讓外層當場更新「N 人收藏」,不必等伺服器快取過期
  }

  return (
    <button className={"savebm" + (floating ? " float" : "") + (saved ? " on" : "")} onClick={toggle} disabled={busy}
      title={saved ? "已收藏" : "收藏"} aria-label={saved ? "已收藏" : "收藏"}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
