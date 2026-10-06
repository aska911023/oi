"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface C { id: string; body: string; created_at: string; name: string | null; user_id: string }

export default function TripComments({ tripId, compact, policy = "all", ownerId }: {
  tripId: string; compact?: boolean; policy?: "all" | "followers" | "off"; ownerId?: string | null;
}) {
  const router = useRouter();
  const [list, setList] = useState<C[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [isFollower, setIsFollower] = useState(false);
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
      if (!alive) return;
      setUid(user?.id || null);
      // 僅粉絲政策:判斷目前使用者是否為貼文主的粉絲
      if (user && policy === "followers" && ownerId && user.id !== ownerId) {
        const { data } = await sb.rpc("follow_stats", { p_uid: ownerId });
        if (alive) setIsFollower(!!(data as { is_following?: boolean })?.is_following);
      }
      await load();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, policy, ownerId]);

  const isOwner = !!uid && uid === ownerId;
  // 能不能留言(前端先擋,後端 RPC 再把關一次)
  const canComment = isOwner || policy === "all" || (policy === "followers" && isFollower);
  const lockMsg = policy === "off" ? "這篇貼文已關閉留言"
    : policy === "followers" ? "只有粉絲可以留言" : null;

  async function submit() {
    if (!uid) { router.push("/login?next=/trips/" + tripId); return; }
    if (!text.trim()) return;
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.rpc("trip_comment_add", { p_trip: tripId, p_body: text.trim() });
    setBusy(false);
    if (error) { alert(error.message || "送出失敗"); return; }
    setText("");
    await load();
  }
  async function del(id: string) {
    if (!confirm("刪除這則留言?")) return;
    const sb = createClient();
    const { error } = await sb.from("trip_comments").delete().eq("id", id);
    if (error) { alert("刪除失敗:" + error.message); return; }
    await load();
  }

  return (
    <div className={compact ? "tc-compact" : "shop-block"}>
      {compact
        ? <div className="tc-head">留言 {list.length > 0 && <span>{list.length}</span>}</div>
        : <h2 className="serif shop-h">留言 {list.length > 0 && <span className="count">{list.length}</span>}</h2>}

      {policy === "off" && !isOwner ? (
        <div className="tc-locked">🔒 {lockMsg}</div>
      ) : canComment ? (
        <div className="review-form">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={uid ? "留個言、給點建議…" : "登入後即可留言"} />
          <div style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? "送出中…" : "送出留言"}</button></div>
        </div>
      ) : (
        <div className="tc-locked">
          🔒 {lockMsg}
          {!uid
            ? <> — <button className="lnk" onClick={() => router.push("/login?next=/trips/" + tripId)}>登入</button></>
            : policy === "followers" && ownerId
              ? <> — <button className="lnk" onClick={() => router.push(`/u/${ownerId}`)}>去追蹤作者</button></>
              : null}
        </div>
      )}

      {list.length > 0 && (
        <div className="review-list">
          {list.map((c) => (
            <div className="review-row" key={c.id}>
              <div className="review-top">
                <span className="review-name">{c.name || "旅人"}</span>
                {(uid === c.user_id || isOwner) && <button className="lnk danger" style={{ marginLeft: "auto" }} onClick={() => del(c.id)}>刪</button>}
              </div>
              <p className="review-comment">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
