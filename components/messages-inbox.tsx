"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChatPanel from "./chat-panel";

export interface ConvItem { id: string; label: string; sub: string }

// 收件匣:左側對話清單 + 右側聊天視窗。業者/消費者/總後台共用。
export default function MessagesInbox({ convs, meId, emptyHint, canStartSupport = false }: {
  convs: ConvItem[]; meId: string; emptyHint: string; canStartSupport?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(convs[0]?.id ?? null);
  const cur = convs.find((c) => c.id === sel);

  async function startSupport() {
    const sb = createClient();
    const { error } = await sb.rpc("get_or_create_conversation", { p_kind: "support", p_stay_id: null });
    if (!error && typeof window !== "undefined") window.location.reload();
  }

  return (
    <div className="shell msgs-wrap" style={{ paddingTop: 20, paddingBottom: 50 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 className="serif" style={{ fontSize: 24 }}>訊息</h1>
        {canStartSupport && <button className="btn btn-ghost btn-sm" onClick={startSupport}>＋ 聯絡平台客服</button>}
      </div>
      {convs.length === 0 ? <p style={{ color: "var(--muted)" }}>{emptyHint}</p> : (
        <div className="msgs-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,250px) 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {convs.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)}
                style={{ textAlign: "left", padding: "11px 13px", cursor: "pointer", borderRadius: 11, background: c.id === sel ? "var(--green-soft)" : "#fff", border: c.id === sel ? "1.5px solid var(--green)" : "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{c.sub}</div>
              </button>
            ))}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 13, padding: 14, background: "#fff" }}>
            {cur ? <>
              <div style={{ fontWeight: 700, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>{cur.label}</div>
              <ChatPanel convId={cur.id} meId={meId} height={460} />
            </> : <p style={{ color: "var(--muted)" }}>選一則對話開始聊天。</p>}
          </div>
        </div>
      )}
      <style>{`@media (max-width: 680px){ .msgs-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
