"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";
import type { RoomType } from "@/lib/types";

// 消費者線上訂房:登入牆 → 表單 → create_booking RPC → 顯示訂單編號 + 轉帳資訊。
// 偶宿不經手金流,款項由房客直接匯給民宿(payment_info 由業者在後台填)。
export default function BookNow({ stayId, stayName, rooms, bookingNote, depositPct }: {
  stayId: string; stayName: string; rooms: RoomType[]; bookingNote?: string | null; depositPct?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ci, setCi] = useState("");
  const [co, setCo] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const nights = (() => {
    if (!ci || !co) return 0;
    const d = (new Date(co).getTime() - new Date(ci).getTime()) / 86400000;
    return d > 0 ? Math.round(d) : 0;
  })();
  const setQty = (id: string, q: number) => setPicked((p) => ({ ...p, [id]: Math.max(0, q) }));
  const total = rooms.reduce((s, r) => s + (Number(r.price) || 0) * (picked[r.id] || 0) * nights, 0);
  const deposit = Math.round(total * (depositPct || 0) / 100);

  async function openForm() {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", {
        title: "線上訂房", desc: "加入會員即可線上預訂,訂單會直接送到民宿。",
      });
      return;
    }
    setOpen(true);
  }

  async function submit() {
    setErr(null);
    if (!ci || !co) { setErr("請選擇入住與退房日期"); return; }
    if (nights <= 0) { setErr("退房日需晚於入住日"); return; }
    if (!name.trim() || !phone.trim()) { setErr("請填寫姓名與電話"); return; }
    const roomsArr = Object.entries(picked).filter(([, q]) => q > 0).map(([room_type_id, qty]) => ({ room_type_id, qty }));
    setBusy(true);
    const sb = createClient();
    const { data, error } = await sb.rpc("create_booking", {
      p_stay_id: stayId, p_check_in: ci, p_check_out: co, p_adults: adults, p_children: children,
      p_guest_name: name, p_guest_phone: phone, p_guest_email: email, p_note: note, p_rooms: roomsArr,
    });
    setBusy(false);
    if (error) { setErr(error.message || "送出失敗,請稍後再試"); return; }
    setDone(data as string);
  }

  const field: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 15, background: "#fff", color: "var(--text)" };
  const lbl: React.CSSProperties = { fontSize: 13, color: "var(--text-2)", fontWeight: 600, display: "block", marginBottom: 5 };

  return (
    <>
      <button className="btn btn-primary" onClick={openForm}>📅 線上訂房</button>
      {open && (
        <>
          <div className="overlay" onClick={() => !busy && setOpen(false)} style={{ zIndex: 1200 }} />
          <div className="detail" role="dialog" aria-modal="true" style={{ maxWidth: 540, zIndex: 1201 }}>
            <button className="close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
            <div className="detail-body">
              {done ? (
                <div style={{ textAlign: "center", padding: "6px 0" }}>
                  <div style={{ fontSize: 42 }}>✅</div>
                  <h2 className="serif" style={{ marginTop: 4 }}>訂房已送出</h2>
                  <p style={{ color: "var(--text-2)" }}>訂單編號 <b style={{ letterSpacing: 1 }}>{done}</b></p>
                  <p style={{ color: "var(--text-2)", fontSize: 14 }}>目前狀態:<b>待民宿確認</b>,確認後會與您聯繫。</p>
                  <div style={{ marginTop: 16, textAlign: "left", background: "var(--green-soft)", borderRadius: 11, padding: "14px 16px" }}>
                    {deposit > 0 && <div style={{ fontWeight: 700, color: "var(--green)", marginBottom: 8, fontSize: 15 }}>💰 請匯訂金 NT$ {deposit.toLocaleString()} <span style={{ fontWeight: 400, fontSize: 12.5, color: "var(--muted)" }}>(總價的 {depositPct}%)</span></div>}
                    <div style={{ fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>💳 匯款 / 確認訊息</div>
                    {bookingNote
                      ? <div style={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.7 }}>{bookingNote}</div>
                      : <div style={{ fontSize: 14, color: "var(--muted)" }}>民宿確認訂單後,會提供匯款帳戶 / 付款方式給您。</div>}
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => { setOpen(false); setDone(null); }}>完成</button>
                </div>
              ) : (
                <>
                  <h2 className="serif" style={{ marginBottom: 4 }}>線上訂房</h2>
                  <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 16 }}>{stayName}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={lbl}>入住日</label><input style={field} type="date" min={today} value={ci} onChange={(e) => setCi(e.target.value)} /></div>
                    <div><label style={lbl}>退房日</label><input style={field} type="date" min={ci || today} value={co} onChange={(e) => setCo(e.target.value)} /></div>
                    <div><label style={lbl}>大人</label><input style={field} type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} /></div>
                    <div><label style={lbl}>小孩</label><input style={field} type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))} /></div>
                  </div>
                  {nights > 0 && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>共 {nights} 晚</p>}

                  {rooms.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <label style={lbl}>選擇房型 / 數量</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {rooms.map((r) => (
                          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.kind === "whole" ? "包棟 · " : ""}{r.name}</div>
                              {Number(r.price) > 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>NT$ {Number(r.price).toLocaleString()} / 晚</div>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQty(r.id, (picked[r.id] || 0) - 1)}>−</button>
                              <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{picked[r.id] || 0}</span>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQty(r.id, (picked[r.id] || 0) + 1)}>＋</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                    <div><label style={lbl}>姓名 *</label><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="訂房人姓名" /></div>
                    <div><label style={lbl}>電話 *</label><input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="聯絡電話" /></div>
                  </div>
                  <div style={{ marginTop: 12 }}><label style={lbl}>Email(選填)</label><input style={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="收訂房通知用" /></div>
                  <div style={{ marginTop: 12 }}><label style={lbl}>備註(選填)</label><textarea style={{ ...field, minHeight: 64, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="特殊需求、抵達時間…" /></div>

                  {err && <div style={{ color: "#c0392b", fontSize: 14, marginTop: 10 }}>{err}</div>}
                  <button className="btn btn-primary" disabled={busy} onClick={submit} style={{ marginTop: 16, width: "100%" }}>
                    {busy ? "送出中…" : `送出訂房${total > 0 ? `(約 NT$ ${total.toLocaleString()})` : ""}`}
                  </button>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>送出後民宿會確認空房並與您聯繫。偶宿不經手金流,款項直接與民宿往來;實際房價與空房以民宿確認為準。</p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
