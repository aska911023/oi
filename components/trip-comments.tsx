"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface C { id: string; body: string; created_at: string; name: string | null }

export default function TripComments({ tripId, compact }: { tripId: string; compact?: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<C[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const sb = createClient();
    const { data } = await sb.rpc("trip_comments_list", { p_trip: tripId });
    setList((data as C[]) || []);
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (alive) setUid(user?.id || null);
      await load();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function submit() {
    if (!uid) { router.push("/login?next=/trips/" + tripId); return; }
    if (!text.trim()) return;
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("trip_comments").insert({ trip_id: tripId, user_id: uid, body: text.trim() });
    setBusy(false);
    if (error) { alert("送出失敗:" + error.message); return; }
    setText("");
    await load();
  }
  async function del(id: string) {
    if (!confirm("刪除這則留言?")) return;
    const sb = createClient();
    await sb.from("trip_comments").delete().eq("id", id);
    await load();
  }

  return (
    <div className={compact ? "tc-compact" : "shop-block"}>
      {compact
        ? <div className="tc-head">留言 {list.length > 0 && <span>{list.length}</span>}</div>
        : <h2 className="serif shop-h">留言 {list.length > 0 && <span className="count">{list.length}</span>}</h2>}
      <div className="review-form">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={uid ? "留個言、給點建議…" : "登入後即可留言"} />
        <div style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? "送出中…" : "送出留言"}</button></div>
      </div>
      {list.length > 0 && (
        <div className="review-list">
          {list.map((c) => (
            <div className="review-row" key={c.id}>
              <div className="review-top">
                <span className="review-name">{c.name || "旅人"}</span>
                {uid && <button className="lnk danger" style={{ marginLeft: "auto" }} onClick={() => del(c.id)}>刪</button>}
              </div>
              <p className="review-comment">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
