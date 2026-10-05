"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MultiImageUploader from "@/components/admin/multi-image-uploader";

export default function PostComposer({ loggedIn, onPosted }: { loggedIn: boolean; onPosted?: () => void }) {
  const [body, setBody] = useState("");
  const [imgs, setImgs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!loggedIn) {
    return <div className="feed-login">登入後即可發文、按讚與留言。<Link href="/login?next=/feed">登入 / 註冊</Link></div>;
  }

  async function submit() {
    if (!body.trim() && imgs.length === 0) return;
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await sb.from("posts").insert({ user_id: user.id, body: body.trim() || null, images: imgs });
    setBusy(false);
    if (error) { alert("發文失敗:" + error.message); return; }
    setBody(""); setImgs([]);
    onPosted?.();
  }

  return (
    <div className="composer">
      <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="分享你的旅程、推薦的民宿或景點…" />
      <MultiImageUploader prefix="post" value={imgs} onChange={setImgs} compact />
      <div className="composer-actions">
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "發布中…" : "發布"}</button>
      </div>
    </div>
  );
}
