"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ReviewForm({ stayId }: { stayId: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !alive) return;
      setUid(user.id);
      const { data } = await sb.from("reviews").select("rating, comment").eq("stay_id", stayId).eq("user_id", user.id).maybeSingle();
      if (data && alive) { setRating(data.rating); setComment(data.comment || ""); }
    })();
    return () => { alive = false; };
  }, [stayId]);

  async function save() {
    if (!uid) { router.push("/login?next=/stay/" + stayId); return; }
    if (!rating) { alert("請先點星星評分"); return; }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("reviews").upsert({ stay_id: stayId, user_id: uid, rating, comment: comment.trim() }, { onConflict: "stay_id,user_id" });
    setBusy(false);
    if (error) { alert("送出失敗:" + error.message); return; }
    setDone(true);
    router.refresh();
  }

  if (!uid) {
    return <p style={{ fontSize: 14, color: "var(--muted)" }}><a className="lnk" onClick={() => router.push("/login?next=/stay/" + stayId)} style={{ cursor: "pointer" }}>登入</a>後即可留下評價。</p>;
  }

  return (
    <div className="review-form">
      <div className="stars-input">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={"star" + ((hover || rating) >= n ? " on" : "")}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} aria-label={`${n} 星`}>★</button>
        ))}
      </div>
      <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="分享你的入住體驗(選填)" />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? "送出中…" : "送出評價"}</button>
        {done && <span style={{ color: "var(--green)", fontSize: 13, fontWeight: 700 }}>✓ 已送出</span>}
      </div>
    </div>
  );
}
