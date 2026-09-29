"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RentalPlan } from "@/lib/types";

type Row = Partial<RentalPlan> & { _dirty?: boolean };

const blank = (shopId: string): Row => ({
  shop_id: shopId, name: "", price_per_day: 1500, deposit: null, includes: "", count_total: null, count_left: null,
  image: "", description: "", sort: 0, published: true, _dirty: true,
});

export default function RentalPlansEditor({ shopId, onChange }: { shopId: string; onChange?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("rental_plans").select("*").eq("shop_id", shopId).order("sort").order("price_per_day");
      if (alive) { setRows((data as Row[]) || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [shopId]);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p, _dirty: true } : x)));
  const add = () => setRows((r) => [...r, blank(shopId)]);

  async function removeRow(i: number) {
    const row = rows[i];
    if (row.id) {
      if (!confirm(`刪除方案「${row.name || "未命名"}」?`)) return;
      const sb = createClient();
      await sb.from("rental_plans").delete().eq("id", row.id);
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
        shop_id: shopId, name: row.name.trim(), price_per_day: Number(row.price_per_day) || 0,
        deposit: row.deposit ?? null, includes: row.includes || "", count_total: row.count_total ?? null,
        count_left: row.count_left ?? null, image: row.image || "", description: row.description || "",
        sort: Number(row.sort) || 0, published: row.published ?? true,
      };
      if (row.id) await sb.from("rental_plans").update(payload).eq("id", row.id);
      else await sb.from("rental_plans").insert(payload);
    }
    const { data } = await sb.from("rental_plans").select("*").eq("shop_id", shopId).order("sort").order("price_per_day");
    setRows((data as Row[]) || []);
    setBusy(false);
    onChange?.();
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 13 }}>載入方案…</p>;

  return (
    <div className="rt-editor">
      <div className="rt-head"><b>方案 / 車型</b><span className="sub">前台「起價 / 可租數」會自動用方案彙整</span></div>
      {rows.length === 0 && <div className="day-empty">還沒有方案,點下方「＋ 新增方案」。至少要有一個方案。</div>}
      <div className="rt-list">
        {rows.map((r, i) => (
          <div className="rt-row" key={r.id || "new" + i}>
            <input className="rt-name" value={r.name || ""} placeholder="車型 / 方案(經濟房車)" onChange={(e) => patch(i, { name: e.target.value })} />
            <span className="rt-num">NT$<input type="number" min={0} value={r.price_per_day ?? 0} onChange={(e) => patch(i, { price_per_day: Number(e.target.value) })} />/日</span>
            <span className="rt-num">押<input type="number" min={0} value={r.deposit ?? ""} placeholder="—" onChange={(e) => patch(i, { deposit: e.target.value === "" ? null : Number(e.target.value) })} /></span>
            <span className="rt-num">可租<input type="number" min={0} value={r.count_left ?? ""} placeholder="—" onChange={(e) => patch(i, { count_left: e.target.value === "" ? null : Number(e.target.value) })} />台</span>
            <input className="rt-name" value={r.includes || ""} placeholder="含:全險、200km、兒童座椅…" onChange={(e) => patch(i, { includes: e.target.value })} />
            <button className="lnk danger" onClick={() => removeRow(i)}>刪</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={add}>＋ 新增方案</button>
        <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={busy}>{busy ? "儲存中…" : "儲存方案"}</button>
      </div>
    </div>
  );
}
