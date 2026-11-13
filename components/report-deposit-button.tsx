"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 房客回報已匯訂金(匯款後五碼必填 + 姓名/電話/備註)→ report_deposit RPC → 狀態轉「待核對訂金」
export default function ReportDepositButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [last5, setLast5] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!last5.trim()) { setErr("請填寫匯款帳號後五碼"); return; }
    setBusy(true);
    const { error } = await createClient().rpc("report_deposit", {
      p_booking_id: bookingId, p_last5: last5, p_name: name, p_phone: phone, p_note: note,
    });
    setBusy(false);
    if (error) { setErr(error.message || "送出失敗,請稍後再試"); return; }
    window.location.reload();
  }

  if (!open) return (
    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>✅ 我已匯款,回報匯款資訊</button>
  );

  const field: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--surface,#fff)", color: "var(--text)" };
  return (
    <div style={{ marginTop: 12, padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>回報匯款資訊</div>
      <input style={field} placeholder="匯款帳號後五碼 *" value={last5} onChange={(e) => setLast5(e.target.value)} maxLength={5} inputMode="numeric" />
      <input style={field} placeholder="匯款人姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={field} placeholder="聯絡電話" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={field} placeholder="備註(選填,例:匯款時間)" value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <div style={{ color: "#c0392b", fontSize: 13 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "送出中…" : "送出回報"}</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  );
}
