"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostComposer from "@/components/post-composer";
import PostCard from "@/components/post-card";
import type { Post } from "@/lib/types";

const PAGE = 20;

export default function FeedList({ initial, loggedIn, myId }: { initial: Post[]; loggedIn: boolean; myId: string | null }) {
  const [rows, setRows] = useState<Post[]>(initial);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length < PAGE);

  async function fetchFrom(off: number, append: boolean) {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.rpc("posts_feed", { lim: PAGE, off });
    const nw = (data as Post[]) || [];
    setRows((p) => (append ? [...p, ...nw] : nw));
    setDone(nw.length < PAGE);
    setLoading(false);
  }

  return (
    <>
      <PostComposer loggedIn={loggedIn} onPosted={() => fetchFrom(0, false)} />
      <div className="feed">
        {rows.length === 0 && <div className="empty">還沒有貼文,成為第一個分享的人!</div>}
        {rows.map((p) => <PostCard key={p.id} post={p} myId={myId} />)}
      </div>
      {!done && rows.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => fetchFrom(rows.length, true)} disabled={loading}>{loading ? "載入中…" : "載入更多"}</button>
        </div>
      )}
    </>
  );
}
