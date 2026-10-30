"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Msg { id: string; conv_id: string; sender_id: string; body: string; created_at: string }

// 單一對話視窗:增量輪詢(只抓比上次新的訊息,沒新的就不重繪)+ 標記已讀 + 送訊息。
export default function ChatPanel({ convId, meId, height = 440 }: { convId: string; meId: string; height?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastTs = useRef<string>("1970-01-01T00:00:00Z");
  const idSet = useRef<Set<string>>(new Set());

  async function markRead() {
    try { await createClient().from("conversation_reads").upsert({ conv_id: convId, user_id: meId, last_read_at: new Date().toISOString() }); } catch { /* ignore */ }
  }
  function absorb(rows: Msg[]) {
    const fresh = rows.filter((r) => !idSet.current.has(r.id));
    if (!fresh.length) return false;
    fresh.forEach((r) => idSet.current.add(r.id));
    if (fresh[fresh.length - 1].created_at > lastTs.current) lastTs.current = fresh[fresh.length - 1].created_at;
    setMsgs((m) => [...m, ...fresh]);
    return true;
  }

  useEffect(() => {
    // 切換對話:重置
    idSet.current = new Set();
    lastTs.current = "1970-01-01T00:00:00Z";
    setMsgs([]);
    let alive = true;
    const sb = createClient();
    (async () => {
      const { data } = await sb.from("messages").select("*").eq("conv_id", convId).order("created_at");
      if (!alive) return;
      absorb((data as Msg[]) || []);
      markRead();
    })();
    // 即時推送:新訊息瞬間到(不用等輪詢)
    const ch = sb.channel(`conv-${convId}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conv_id=eq.${convId}` },
      (payload) => { const got = absorb([payload.new as Msg]); if (got && (payload.new as Msg).sender_id !== meId) markRead(); },
    ).subscribe();
    // 備援輪詢:即時連線斷掉時補抓(12 秒,只抓新的)
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await sb.from("messages").select("*").eq("conv_id", convId).gt("created_at", lastTs.current).order("created_at");
      const got = absorb((data as Msg[]) || []);
      if (got) markRead();
    }, 12000);
    return () => { alive = false; clearInterval(t); sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);

  async function send() {
    const b = text.trim();
    if (!b || busy) return;
    setBusy(true); setText("");
    const { data, error } = await createClient().from("messages").insert({ conv_id: convId, sender_id: meId, body: b }).select().single();
    setBusy(false);
    if (!error && data) absorb([data as Msg]);
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
