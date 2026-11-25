"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";
import MultiImageUploader from "@/components/admin/multi-image-uploader";

// 民宿「活動專欄」編輯器:每間民宿自己的活動 / 專案 / 加購,顯示在詳情頁動作鈕下方。
// 掛在民宿編輯表內(跟房型一樣用 registerSave 讓主「儲存」一起存)。管理者直接可上架;業者之後綁付費方案才開。
interface Promo {
  id?: string; stay_id: string; title: string; subtitle: string | null; image: string | null;
  link_url: string | null; price_note: string | null; badge: string | null;
  start_date: string | null; end_date: string | null; published: boolean; sort: number;
  _dirty?: boolean;
}

const blank = (stayId: string): Promo => ({
  stay_id: stayId, title: "", subtitle: "", image: "", link_url: "", price_note: "", badge: "",
  start_date: null, end_date: null, published: true, sort: 0, _dirty: true,
});

export default function StayPromosEditor({ stayId, stayName, canManage = false, hideSave = false, registerSave }: {
  stayId: string; stayName?: string; canManage?: boolean; hideSave?: boolean; registerSave?: (fn: (() => Promise<void>) | null) => void;
}) {
  const [rows, setRows] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("stay_promos").select("*").eq("stay_id", stayId).order("sort").order("created_at", { ascending: false });
      if (alive) { setRows((data as Promo[]) || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [stayId]);

  useEffect(() => {
    registerSave?.(saveAll);
    return () => registerSave?.(null);
  });

  const patch = (i: number, p: Partial<Promo>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p, _dirty: true } : x)));
  const add = () => setRows((r) => [...r, blank(stayId)]);

  async function removeRow(i: number) {
    const row = rows[i];
    if (row.id) {
      if (!confirm(`刪除活動「${row.title || "未命名"}」?`)) return;
      await createClient().from("stay_promos").delete().eq("id", row.id);
      if (canManage) logAdmin("delete", { type: "stay", id: stayId, name: stayName, detail: { 活動: row.title } });
    }
    setRows((r) => r.filter((_, k) => k !== i));
  }

  async function saveAll() {
    setBusy(true);
    const sb = createClient();
    let n = 0;
    for (const row of rows.filter((r) => r._dirty)) {
      if (!row.title?.trim()) continue;
      n++;
      const payload = {
        stay_id: stayId, title: row.title.trim(),
        subtitle: (row.subtitle || "").trim() || null,
        image: row.image || null,
        link_url: (row.link_url || "").trim() || null,
        price_note: (row.price_note || "").trim() || null,
        badge: (row.badge || "").trim() || null,
        start_date: row.start_date || null, end_date: row.end_date || null,
        published: row.published ?? true, sort: Number(row.sort) || 0,
      };
      if (row.id) await sb.from("stay_promos").update(payload).eq("id", row.id);
      else await sb.from("stay_promos").insert(payload);
    }
    const { data } = await sb.from("stay_promos").select("*").eq("stay_id", stayId).order("sort").order("created_at", { ascending: false });
    setRows((data as Promo[]) || []);
    setBusy(false);
    if (canManage && n > 0) logAdmin("save", { type: "stay", id: stayId, name: stayName, detail: { 活動數: n } });
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 13 }}>載入活動專欄…</p>;

  return (
    <div className="rt-editor">
      <div className="rt-head">
        <b>活動專欄</b>
        <span className="sub">顯示在這間民宿詳情頁上方(動作鈕下)。可放住宿專案、加購體驗、節慶活動,引導客人了解或報名。</span>
      </div>

      {rows.length === 0 && <div className="day-empty">還沒有活動,按下方「＋ 新增活動」開始。</div>}

      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((r, i) => (
          <div key={r.id || "new" + i} className="rt-item" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ flex: 1, minWidth: 180 }} value={r.title} placeholder="活動名稱 *(例:冬季限定・溫泉雙人專案)" onChange={(e) => patch(i, { title: e.target.value })} />
              <input style={{ width: 120 }} value={r.badge || ""} placeholder="徽章(限時)" onChange={(e) => patch(i, { badge: e.target.value })} />
              <button type="button" className={"rt-toggle" + ((r.published ?? true) ? " on" : "")} onClick={() => patch(i, { published: !(r.published ?? true) })}>{(r.published ?? true) ? "上架中" : "已隱藏"}</button>
              <button className="lnk danger" onClick={() => removeRow(i)}>刪</button>
            </div>
            <input value={r.subtitle || ""} placeholder="一句話說明(選填)" onChange={(e) => patch(i, { subtitle: e.target.value })} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input style={{ flex: 1, minWidth: 150 }} value={r.price_note || ""} placeholder="價格備註(例:每人 $1,280 起)" onChange={(e) => patch(i, { price_note: e.target.value })} />
              <input style={{ flex: 2, minWidth: 180 }} value={r.link_url || ""} placeholder="報名 / 了解更多連結(選填)" onChange={(e) => patch(i, { link_url: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: "var(--text-2)" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>期間 <input type="date" value={r.start_date || ""} onChange={(e) => patch(i, { start_date: e.target.value || null })} /></label>
              <span>→</span>
              <input type="date" value={r.end_date || ""} onChange={(e) => patch(i, { end_date: e.target.value || null })} />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>排序 <input type="number" style={{ width: 60 }} value={r.sort} onChange={(e) => patch(i, { sort: Number(e.target.value) })} /></label>
            </div>
            <div className="rt-photos">
              <span className="rt-photos-cap">活動圖(1 張)</span>
              <MultiImageUploader prefix="promo" compact
                value={r.image ? [r.image] : []}
                onChange={(imgs) => patch(i, { image: imgs[0] || "" })} />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={add}>＋ 新增活動</button>

      {!hideSave && (
        <div style={{ display: "flex", gap: 10, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={busy}>{busy ? "儲存中…" : "儲存活動"}</button>
        </div>
      )}
    </div>
  );
}
