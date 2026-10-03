"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type SaveType = "stay" | "attraction" | "food" | "parking" | "rental" | "station";

// 書籤收藏 icon。type=stay 用 saved 表;其餘用 saved_places(kind+place_id)。
// floating=true 時浮在圖片右上角。
export default function SaveBookmark({ type, id, floating = false, nextPath = "/" }: { type: SaveType; id: string; floating?: boolean; nextPath?: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
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
    if (!uid) { router.push("/login?next=" + encodeURIComponent(nextPath)); return; }
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
