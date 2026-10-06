"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";

export interface Plan {
  id?: string; key: string; name: string; room_pins: number; priority: number; sort: number;
  builtin?: boolean; _dirty?: boolean; _new?: boolean;
}

export default function PlansEditor({ initial }: { initial: Plan[] }) {
  const [rows, setRows] = useState<Plan[]>(initial);
  const [busy, setBusy] = useState(false);

  const patch = (i: number, p: Partial<Plan>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p, _dirty: true } : x)));

  const addPlan = () => setRows((r) => [...r, { key: `plan_${Date.now()}`, name: "新方案", room_pins: 0, priority: 0, sort: r.length, _new: true, _dirty: true }]);

  async function removePlan(i: number) {
    const row = rows[i];
    if (row.builtin) { alert("內建方案(免費/精選/旗艦)不能刪除,但可以改設定。"); return; }
    if (!confirm(`刪除方案「${row.name}」?\n(已選此方案的民宿會視同免費方案)`)) return;
    if (row.id) { const { error } = await createClient().from("plans").delete().eq("id", row.id); if (error) { alert("刪除失敗:" + error.message); return; } }
    logAdmin("delete", { type: "plan", id: row.id, name: row.name });
    setRows((r) => r.filter((_, k) => k !== i));
  }

  async function saveAll() {
    setBusy(true);
    const sb = createClient();
    for (const row of rows.filter((r) => r._dirty)) {
      const payload = {
        key: row.key, name: (row.name || "").trim() || "未命名",
        room_pins: Math.max(0, Number(row.room_pins) || 0),
        priority: Number(row.priority) || 0, sort: Number(row.sort) || 0,
      };
      const { error } = row.id ? await sb.from("plans").update(payload).eq("id", row.id) : await sb.from("plans").insert(payload);
      if (error) { alert("儲存失敗:" + error.message); setBusy(false); return; }
      logAdmin(row._new ? "create" : "edit", { type: "plan", id: row.id, name: payload.name });
    }
    const { data } = await sb.from("plans").select("*").order("sort");
    setRows((data as Plan[]) || []);
    setBusy(false);
    alert("方案設定已儲存");
  }

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 16px" }}>
        設定曝光方案。<b>可置頂房型數</b>=該方案的民宿能把幾間房型置頂(0=不能置頂;設大數字如 99 等於不限)。
        <b>曝光優先序</b>越高,民宿在搜尋/首頁越前面。免費/精選/旗艦為內建,可改設定、不可刪除。
      </p>

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>方案名稱</th><th>可置頂房型數</th><th>曝光優先序</th><th>類型</th><th>操作</th></tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.key}>
                <td><input className="plan-in" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} /></td>
                <td><input className="plan-in num" type="number" min={0} value={p.room_pins} onChange={(e) => patch(i, { room_pins: Number(e.target.value) })} /></td>
                <td><input className="plan-in num" type="number" value={p.priority} onChange={(e) => patch(i, { priority: Number(e.target.value) })} /></td>
                <td>{p.builtin ? <span className="pill draft">內建</span> : <span className="pill feat">自訂</span>}</td>
                <td>{!p.builtin && <button className="lnk danger" onClick={() => removePlan(i)}>刪除</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 18, alignItems: "center" }}>
        <button className="btn btn-ghost" onClick={addPlan}>＋ 新增方案</button>
        <button className="btn btn-primary" onClick={saveAll} disabled={busy}>{busy ? "儲存中…" : "儲存方案設定"}</button>
      </div>
    </>
  );
}
