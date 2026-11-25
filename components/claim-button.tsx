"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";

const ROLES = [
  { v: "owner", l: "負責人 / 經營者" },
  { v: "manager", l: "受委任管理者" },
  { v: "agent", l: "代理商 / 代管" },
  { v: "employee", l: "員工 / 窗口" },
];

// 詳情頁「認領這間」:未登入→註冊/登入;已登入→填認領申請(免費,送審後由平台核對授權)。
export default function ClaimButton({ kind, targetId, targetName, label = "認領這間" }: {
  kind: string; targetId: string; targetName: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState("owner");
  const [authUntil, setAuthUntil] = useState("");
  const [contact, setContact] = useState("");
  const [relation, setRelation] = useState("");
  const [wish, setWish] = useState("");
  const [material, setMaterial] = useState("");
  const [wantPaid, setWantPaid] = useState(false);

  async function start() {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session?.user) {
      promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", { title: "認領這間店家", desc: "註冊 / 登入後即可申請認領,確認管理授權後就能自己維護這間的資料。" });
      return;
    }
    setOpen(true); setDone(false); setErr(null);
  }

  async function submit() {
    setErr(null);
    if (!contact.trim()) { setErr("請填可供核對的官方聯繫(電話或信箱)"); return; }
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); setErr("請先登入"); return; }
    const { error } = await sb.from("claims").insert({
      kind, target_id: targetId, target_name: targetName, applicant_id: user.id,
      applicant_role: role, auth_until: authUntil || null, contact: contact.trim(),
      relation_note: relation.trim(), wish_note: wish.trim(), material_note: material.trim(), want_paid: wantPaid,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  const field: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14.5, background: "var(--surface,#fff)", color: "var(--text)" };
  const lbl: React.CSSProperties = { fontSize: 13, color: "var(--text-2)", fontWeight: 600, display: "block", marginBottom: 5 };

  return (
    <>
      <button className="btn btn-ghost" onClick={start}>🪪 {label}</button>
      {open && (
        <>
          <div className="overlay" onClick={() => !busy && setOpen(false)} style={{ zIndex: 1200 }} />
          <div className="detail" role="dialog" aria-modal="true" style={{ maxWidth: 520, zIndex: 1201 }}>
            <button className="close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
            <div className="detail-body">
              {done ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 42 }}>🪪</div>
                  <h2 className="serif" style={{ marginTop: 4 }}>認領申請已送出</h2>
                  <p style={{ color: "var(--text-2)", fontSize: 14.5, lineHeight: 1.7 }}>我們會以你提供的官方聯繫<b>獨立核對管理授權</b>,通過後會通知你,屆時即可到「業者後台」維護這間的資料。認領免費,不需付費。</p>
                  <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setOpen(false); }}>完成</button>
                </div>
              ) : (
                <>
                  <h2 className="serif" style={{ marginBottom: 2 }}>認領 — {targetName}</h2>
                  <p style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 14 }}>認領<b>免費</b>。送出後由平台核對你是否有管理授權,通過才給管理權。請勿填與查核無關的身分證 / 銀行 / 旅客資料。</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <div><label style={lbl}>你的角色</label>
                      <select style={field} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
                    </div>
                    <div><label style={lbl}>可供核對的官方聯繫 *(電話或信箱)</label>
                      <input style={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="例:官方市話 03-xxxxxxx 或 官網信箱" /></div>
                    <div><label style={lbl}>授權期間(到期日,選填)</label>
                      <input style={field} type="date" value={authUntil} onChange={(e) => setAuthUntil(e.target.value)} /></div>
                    <div><label style={lbl}>與店家的關係說明</label>
                      <input style={field} value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="例:本人為登記負責人 / 受委任管理" /></div>
                    <div><label style={lbl}>希望更正或新增的內容(選填)</label>
                      <textarea style={{ ...field, minHeight: 60 }} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="例:更新房型與照片、修正營業時間…" /></div>
                    <div><label style={lbl}>素材(照片/文案)授權說明(選填)</label>
                      <input style={field} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="例:照片為本店所有,授權偶宿刊登" /></div>
                    <label className="check" style={{ fontSize: 14 }}><input type="checkbox" checked={wantPaid} onChange={(e) => setWantPaid(e.target.checked)} /> 我想另外了解付費合作(內容整理 / 曝光 / 活動),不影響基本認領</label>
                    {err && <div style={{ color: "#c0392b", fontSize: 13 }}>{err}</div>}
                  </div>
                  <div className="editor-actions" style={{ marginTop: 16 }}>
                    <button className="btn btn-ghost" onClick={() => setOpen(false)}>取消</button>
                    <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "送出中…" : "送出認領申請"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
