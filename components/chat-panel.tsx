"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Msg { id: string; conv_id: string; sender_id: string; body: string; created_at: string }

// 單一對話視窗:載入訊息 + 每 4 秒輪詢(分頁可見時)+ 標記已讀 + 送訊息。
export default function ChatPanel({ convId, meId, height = 440 }: { convId: string; meId: string; height?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    const sb = createClient();
    const { data } = await sb.from("messages").select("*").eq("conv_id", convId).order("created_at");
    setMsgs((data as Msg[]) || []);
    try { await sb.from("conversation_reads").upsert({ conv_id: convId, user_id: meId, last_read_at: new Date().toISOString() }); } catch { /* ignore */ }
  }
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);

  async function send() {
    const b = text.trim();
    if (!b || busy) return;
    setBusy(true); setText("");
    const sb = createClient();
    const { data, error } = await sb.from("messages").insert({ conv_id: convId, sender_id: meId, body: b }).select().single();
    setBusy(false);
    if (!error && data) setMsgs((m) => [...m, data as Msg]);
    else setText(b);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height }}>
      <div ref={boxRef} style={{ flex: 1, overflowY: "auto", padding: "6px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 0 && <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", marginTop: 24 }}>還沒有訊息,傳第一句打個招呼吧 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div style={{ background: mine ? "var(--green)" : "var(--green-soft)", color: mine ? "#fff" : "var(--text)", padding: "8px 12px", borderRadius: 14, fontSize: 14.5, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>{m.body}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="輸入訊息…" style={{ flex: 1, padding: "9px 13px", border: "1px solid var(--border)", borderRadius: 20, fontSize: 14.5 }} />
        <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={send}>送出</button>
      </div>
    </div>
  );
}
