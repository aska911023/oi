"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";
import ChatPanel from "./chat-panel";

// 消費者「私訊民宿」:登入牆 → get_or_create_conversation(booking) → 開聊天 modal。
export default function ContactVendor({ stayId, stayName }: { stayId: string; stayName: string }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openChat() {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", { title: "私訊民宿", desc: "加入會員即可直接私訊民宿詢問空房、設施與合作。" }); return; }
    setErr(null); setOpen(true); setMeId(user.id);
    const { data, error } = await sb.rpc("get_or_create_conversation", { p_kind: "booking", p_stay_id: stayId });
    if (error) { setErr(error.message); return; }
    setConvId(data as string);
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={openChat}>💬 私訊民宿</button>
      {open && (
        <>
          <div className="overlay" onClick={() => setOpen(false)} />
          <div className="detail" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
            <button className="close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
            <div className="detail-body">
              <h2 className="serif" style={{ marginBottom: 2 }}>私訊 · {stayName}</h2>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>訊息會送到民宿;對方回覆後可在「我的訊息」查看。</p>
              {err ? <p style={{ color: "#c0392b", fontSize: 14 }}>{err}</p>
                : (convId && meId ? <ChatPanel convId={convId} meId={meId} height={360} />
                  : <p style={{ color: "var(--muted)", fontSize: 14 }}>載入中…</p>)}
            </div>
          </div>
        </>
      )}
    </>
  );
}
