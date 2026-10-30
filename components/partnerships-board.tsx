"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 異業合作 / 合作需求看板:業者發布需求(找外燴、接駁、攝影…)、彼此瀏覽聯絡;總後台看全部。
export interface Post {
  id: string; owner_id: string; stay_id: string | null; title: string;
  category: string; detail: string; contact: string; status: string; created_at: string;
}
const CATS = ["外燴 / 烤肉", "接駁車", "攝影 / 空拍", "寢具布品", "清潔 / 消毒", "食材 / 伴手禮", "行程 / 體驗", "設備維修", "其他"];

export default function PartnershipsBoard({ initial, ownerId, isAdmin, myStays }: {
  initial: Post[]; ownerId: string; isAdmin: boolean; myStays: { id: string; name: string }[];
}) {
  const [posts, setPosts] = useState<Post[]>(initial);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = posts.filter((p) => p.owner_id === ownerId);
  const others = posts.filter((p) => p.owner_id !== ownerId && p.status === "open");
  const stayName = (id: string | null) => myStays.find((s) => s.id === id)?.name;

  async function save() {
    setErr(null);
    const e = editing!;
    if (!(e.title || "").trim()) { setErr("請填寫標題"); return; }
    if (!(e.contact || "").trim()) { setErr("請填寫聯絡方式(讓對方找得到你)"); return; }
    setBusy(true);
    const sb = createClient();
    const payload = {
      title: (e.title || "").trim(), category: e.category || CATS[0],
      detail: (e.detail || "").trim(), contact: (e.contact || "").trim(),
      stay_id: e.stay_id || null,
    };
    if (e.id) {
      const { error } = await sb.from("partnership_posts").update(payload).eq("id", e.id);
      if (!error) setPosts((ps) => ps.map((p) => (p.id === e.id ? { ...p, ...payload } : p)));
      setBusy(false); if (error) { setErr(error.message); return; }
    } else {
      const { data, error } = await sb.from("partnership_posts").insert({ ...payload, owner_id: ownerId }).select().single();
      setBusy(false); if (error) { setErr(error.message); return; }
      if (data) setPosts((ps) => [data as Post, ...ps]);
    }
    setEditing(null);
  }

  async function setStatus(id: string, status: string) {
    const sb = createClient();
    await sb.from("partnership_posts").update({ status }).eq("id", id);
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
  }
  async function del(id: string) {
    if (!confirm("確定刪除這則需求?")) return;
    const sb = createClient();
    await sb.from("partnership_posts").delete().eq("id", id);
    setPosts((ps) => ps.filter((p) => p.id !== id));
  }

  const card = (p: Post, own: boolean) => (
    <div key={p.id} className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ background: "var(--green-soft)", color: "var(--green)" }}>{p.category}</span>
        {p.status === "closed" && <span className="pill" style={{ background: "#eee", color: "#888" }}>已結案</span>}
        {stayName(p.stay_id) && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>· {stayName(p.stay_id)}</span>}
      </div>
      <h3 style={{ fontSize: 17, margin: "8px 0 4px" }}>{p.title}</h3>
      {p.detail && <p style={{ fontSize: 14, color: "var(--text-2)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{p.detail}</p>}
      <div style={{ marginTop: 10, fontSize: 14 }}>📞 聯絡:<b>{p.contact}</b></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {own && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>編輯</button>}
        {own && p.status === "open" && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p.id, "closed")}>標記結案</button>}
        {own && p.status === "closed" && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p.id, "open")}>重新開啟</button>}
        {(own || isAdmin) && <button className="btn btn-ghost btn-sm" style={{ color: "#c0392b" }} onClick={() => del(p.id)}>刪除</button>}
      </div>
    </div>
  );

  return (
    <div className="shell" style={{ paddingTop: 20, paddingBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 26 }}>異業合作 · 合作需求</h1>
          <p style={{ color: "var(--text-2)", fontSize: 14, marginTop: 4 }}>
            {isAdmin ? "平台所有業者張貼的合作需求。" : "張貼你的合作需求,或看看其他業者在找什麼夥伴,直接聯絡媒合。"}
          </p>
        </div>
        {!isAdmin && <button className="btn btn-primary" onClick={() => setEditing({ category: CATS[0] })}>＋ 發布合作需求</button>}
      </div>

      {!isAdmin && (
        <section style={{ marginTop: 24 }}>
          <h2 className="serif shop-h">我的需求 <span className="count">{mine.length}</span></h2>
          {mine.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 14 }}>還沒有發布需求。點右上「發布合作需求」開始。</p>
            : <div className="cards">{mine.map((p) => card(p, true))}</div>}
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <h2 className="serif shop-h">{isAdmin ? "全部需求" : "找合作夥伴"} <span className="count">{isAdmin ? posts.length : others.length}</span></h2>
        {(isAdmin ? posts : others).length === 0
          ? <p style={{ color: "var(--muted)", fontSize: 14 }}>目前沒有{isAdmin ? "" : "其他業者的"}合作需求。</p>
          : <div className="cards">{(isAdmin ? posts : others).map((p) => card(p, isAdmin ? p.owner_id === ownerId : false))}</div>}
      </section>

      {editing && (
        <>
          <div className="overlay" onClick={() => !busy && setEditing(null)} />
          <div className="detail" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
            <button className="close" onClick={() => setEditing(null)} aria-label="關閉">✕</button>
            <div className="detail-body">
              <h2 className="serif" style={{ marginBottom: 14 }}>{editing.id ? "編輯合作需求" : "發布合作需求"}</h2>
              <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>類別</label>
              <select value={editing.category || CATS[0]} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={{ width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, margin: "5px 0 12px" }}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>標題 *</label>
              <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="例:員山民宿長期找到府烤肉配合" style={{ width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, margin: "5px 0 12px" }} />
              <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>需求說明</label>
              <textarea value={editing.detail || ""} onChange={(e) => setEditing({ ...editing, detail: e.target.value })} rows={4} placeholder="說明合作內容、條件、數量、時間…" style={{ width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, margin: "5px 0 12px", resize: "vertical" }} />
              <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>聯絡方式 *</label>
              <input value={editing.contact || ""} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} placeholder="例:LINE @abc123 / 王先生 0912-345-678" style={{ width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, margin: "5px 0 12px" }} />
              {myStays.length > 0 && (
                <>
                  <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>對應民宿(選填)</label>
                  <select value={editing.stay_id || ""} onChange={(e) => setEditing({ ...editing, stay_id: e.target.value || null })} style={{ width: "100%", padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 9, margin: "5px 0 12px" }}>
                    <option value="">— 不指定 —</option>
                    {myStays.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </>
              )}
              {err && <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 8 }}>{err}</div>}
              <button className="btn btn-primary" disabled={busy} onClick={save} style={{ width: "100%" }}>{busy ? "儲存中…" : "儲存"}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
