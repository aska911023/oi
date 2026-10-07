"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 一般使用者的「分享影音/IG」:貼連結 + 標題就發,存成 trips(kind=media),
// 讚/留言/追蹤/通知全部沿用既有行程那套。不用規劃天數/景點。
const isValidUrl = (u: string) => /^https?:\/\/.+/.test(u.trim());

export default function MediaCompose({ loggedIn, myName, myAvatar }: { loggedIn: boolean; myName: string; myAvatar: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [policy, setPolicy] = useState("all");
  const [busy, setBusy] = useState(false);

  function openModal() {
    if (!loggedIn) { router.push("/login?next=/trips"); return; }
    setOpen(true);
  }

  async function submit() {
    if (!title.trim()) { alert("幫這則影音取個標題吧"); return; }
    if (!isValidUrl(url)) { alert("請貼上有效的 YouTube / Instagram / TikTok 連結"); return; }
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); router.push("/login?next=/trips"); return; }
    const { data, error } = await sb.from("trips").insert({
      owner_id: user.id, title: title.trim(), kind: "media",
      days: 1, nights: 0, headcount: 1, items: [],
      embed_urls: [url.trim()], summary: caption.trim() || null,
      is_public: isPublic, comment_policy: policy,
    }).select("id").single();
    setBusy(false);
    if (error) { alert("分享失敗:" + error.message); return; }
    setOpen(false);
    router.push(`/trips/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="compose-shortcut cs-media" onClick={openModal}>
        <span className="cs-avatar" aria-hidden>▶</span>
        <span className="cs-prompt">{loggedIn ? "分享一則 IG / YouTube 影音…" : "登入後分享影音…"}</span>
        <span className="btn btn-primary btn-sm cs-btn">分享影音</span>
      </button>

      {open && (
        <>
          <div className="overlay" onClick={() => setOpen(false)} />
          <div className="editor" role="dialog" aria-modal="true" style={{ width: "min(560px, 94vw)" }}>
            <h2>分享影音 / IG</h2>
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6, marginBottom: 14 }}>貼上 YouTube / Instagram 貼文 / TikTok 連結,不用規劃行程。</p>
            <div className="form-grid">
              <div className="wide"><label>標題 *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例:宜蘭這間包棟也太美" /></div>
              <div className="wide"><label>影音連結 *</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/… 或 https://youtu.be/…" /></div>
              <div className="wide"><label>說明(選填)</label><textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="想說的話…" /></div>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <label className="check"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> 公開分享到行程牆</label>
              <label className="check" style={{ gap: 6 }}>誰可以留言
                <select value={policy} onChange={(e) => setPolicy(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-strong)" }}>
                  <option value="all">所有人</option>
                  <option value="followers">只有粉絲</option>
                  <option value="off">關閉留言</option>
                </select>
              </label>
            </div>
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "分享中…" : "分享"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
