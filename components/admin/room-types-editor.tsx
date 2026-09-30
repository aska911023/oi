"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomType } from "@/lib/types";

type Row = Partial<RoomType> & { _new?: boolean; _dirty?: boolean };

const blank = (stayId: string): Row => ({
  stay_id: stayId, name: "", price: 2000, capacity: 2, rooms_total: null, rooms_left: null,
  beds: "", amenities: "", image: "", description: "", sort: 0, published: true, featured: false, _new: true, _dirty: true,
});

export default function RoomTypesEditor({ stayId, onChange, allowFeatured = false }: { stayId: string; onChange?: () => void; allowFeatured?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("room_types").select("*").eq("stay_id", stayId).order("sort").order("price");
      if (alive) { setRows((data as Row[]) || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [stayId]);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p, _dirty: true } : x)));
  const add = () => setRows((r) => [...r, blank(stayId)]);

  async function removeRow(i: number) {
    const row = rows[i];
    if (row.id) {
      if (!confirm(`刪除房型「${row.name || "未命名"}」?`)) return;
      const sb = createClient();
      await sb.from("room_types").delete().eq("id", row.id);
    }
    setRows((r) => r.filter((_, k) => k !== i));
    onChange?.();
  }

  async function saveAll() {
    setBusy(true);
    const sb = createClient();
    for (const row of rows.filter((r) => r._dirty)) {
      if (!row.name?.trim()) continue;
      const payload = {
        stay_id: stayId, name: row.name.trim(), price: Number(row.price) || 0, capacity: Number(row.capacity) || 1,
        rooms_total: row.rooms_total ?? null, rooms_left: row.rooms_left ?? null, beds: row.beds || null,
        amenities: row.amenities || "", image: row.image || "", description: row.description || "",
        sort: Number(row.sort) || 0, published: row.published ?? true, featured: row.featured ?? false,
      };
      if (row.id) await sb.from("room_types").update(payload).eq("id", row.id);
      else await sb.from("room_types").insert(payload);
    }
    const { data } = await sb.from("room_types").select("*").eq("stay_id", stayId).order("sort").order("price");
    setRows((data as Row[]) || []);
    setBusy(false);
    onChange?.();
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 13 }}>載入房型…</p>;

  return (
    <div className="rt-editor">
      <div className="rt-head">
        <b>房型管理</b>
        <span className="sub">前台「起價 / 剩餘 / 人數」會自動用房型彙整</span>
      </div>

      {rows.length === 0 && <div className="day-empty">還沒有房型,點下方「＋ 新增房型」。至少要有一個房型。</div>}

      <div className="rt-list">
        {rows.map((r, i) => (
          <div className="rt-row" key={r.id || "new" + i}>
            <input className="rt-name" value={r.name || ""} placeholder="房型名稱(雙人房)" onChange={(e) => patch(i, { name: e.target.value })} />
            <span className="rt-num">NT$<input type="number" min={0} value={r.price ?? 0} onChange={(e) => patch(i, { price: Number(e.target.value) })} />/晚</span>
            <span className="rt-num">可住<input type="number" min={1} value={r.capacity ?? 2} onChange={(e) => patch(i, { capacity: Number(e.target.value) })} />人</span>
            <span className="rt-num">剩<input type="number" min={0} value={r.rooms_left ?? ""} placeholder="—" onChange={(e) => patch(i, { rooms_left: e.target.value === "" ? null : Number(e.target.value) })} />間</span>
            <button type="button" className={"rt-toggle" + ((r.published ?? true) ? " on" : "")} onClick={() => patch(i, { published: !(r.published ?? true) })}>{(r.published ?? true) ? "上架中" : "已隱藏"}</button>
            {allowFeatured && <button type="button" className={"rt-toggle feat" + (r.featured ? " on" : "")} onClick={() => patch(i, { featured: !r.featured })}>{r.featured ? "★置頂" : "置頂"}</button>}
            <button className="lnk danger" onClick={() => removeRow(i)}>刪</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={add}>＋ 新增房型</button>
        <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={busy}>{busy ? "儲存中…" : "儲存房型"}</button>
      </div>
    </div>
  );
}
