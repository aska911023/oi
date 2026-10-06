"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";
import { ROOM_TAGS, WHOLE_HOUSE_TAGS } from "@/lib/data";
import TagPalette from "@/components/admin/tag-palette";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import type { RoomType, RoomKind, RoomPricing } from "@/lib/types";

type Row = Partial<RoomType> & { _new?: boolean; _dirty?: boolean };

// 包棟分時期價格欄位
const PERIODS: { key: keyof RoomPricing; label: string }[] = [
  { key: "weekday", label: "平日" },
  { key: "peak_weekday", label: "旺季平日" },
  { key: "minor_holiday", label: "小假日" },
  { key: "holiday", label: "假日" },
  { key: "rack", label: "定價" },
];

const blank = (stayId: string, kind: RoomKind): Row => ({
  stay_id: stayId, kind, name: "", price: kind === "whole" ? 8000 : 2000, capacity: kind === "whole" ? 6 : 2,
  rooms_total: null, rooms_left: null, beds: "", amenities: "", image: "", images: [], description: "",
  pricing: {}, includes_note: "", sort: 0, published: true, featured: false, tags: [], _new: true, _dirty: true,
});

export default function RoomTypesEditor({ stayId, stayName, onChange, allowFeatured = false, canManage = false, roomPinQuota = 0 }: { stayId: string; stayName?: string; onChange?: () => void; allowFeatured?: boolean; canManage?: boolean; roomPinQuota?: number }) {
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
  const patchPrice = (i: number, key: keyof RoomPricing, val: string) =>
    setRows((r) => r.map((x, k) => (k === i ? { ...x, pricing: { ...(x.pricing || {}), [key]: val === "" ? null : Number(val) }, _dirty: true } : x)));
  // 自訂價格欄(pricing.extras)
  const updExtras = (i: number, fn: (ex: { label: string; amount: number | null }[]) => { label: string; amount: number | null }[]) =>
    setRows((r) => r.map((x, k) => (k === i ? { ...x, pricing: { ...(x.pricing || {}), extras: fn(x.pricing?.extras || []) }, _dirty: true } : x)));
  const addExtra = (i: number) => updExtras(i, (ex) => [...ex, { label: "", amount: null }]);
  const delExtra = (i: number, xi: number) => updExtras(i, (ex) => ex.filter((_, j) => j !== xi));
  const setExtra = (i: number, xi: number, field: "label" | "amount", val: string) =>
    updExtras(i, (ex) => ex.map((e, j) => (j === xi ? { ...e, [field]: field === "amount" ? (val === "" ? null : Number(val)) : val } : e)));
  const add = (kind: RoomKind) => setRows((r) => [...r, blank(stayId, kind)]);

  async function removeRow(i: number) {
    const row = rows[i];
    if (row.id) {
      if (!confirm(`刪除房型「${row.name || "未命名"}」?`)) return;
      const sb = createClient();
      await sb.from("room_types").delete().eq("id", row.id);
      if (canManage) logAdmin("delete", { type: "room", id: row.id, name: row.name, detail: { stay: stayName } });
    }
    setRows((r) => r.filter((_, k) => k !== i));
    onChange?.();
  }

  async function saveAll() {
    setBusy(true);
    const sb = createClient();
    let savedCount = 0;
    for (const row of rows.filter((r) => r._dirty)) {
      if (!row.name?.trim()) continue;
      savedCount++;
      const kind: RoomKind = row.kind === "whole" ? "whole" : "single";
      const pricing = row.pricing || {};
      if (pricing.extras) pricing.extras = pricing.extras.filter((e) => (e.label || "").trim() && e.amount != null);
      // 包棟起價 = 有填的各時期價格中最低者(沒填則沿用原價);單間用自己的價格
      const periodVals = [pricing.weekday, pricing.peak_weekday, pricing.minor_holiday, pricing.holiday, pricing.rack]
        .map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
      const price = kind === "whole" ? (periodVals.length ? Math.min(...periodVals) : (Number(row.price) || 0)) : (Number(row.price) || 0);
      const payload = {
        stay_id: stayId, kind, name: row.name.trim(), price, capacity: Number(row.capacity) || 1,
        rooms_total: row.rooms_total ?? null, rooms_left: row.rooms_left ?? null, beds: row.beds || null,
        amenities: row.amenities || "",
        image: (row.images && row.images[0]) || row.image || "",
        images: row.images || [],
        description: row.description || "",
        pricing, includes_note: kind === "whole" ? (row.includes_note || "") : null,
        sort: Number(row.sort) || 0,
        published: canManage ? (row.published ?? true) : (row.id ? undefined : false), // 房型上架只有 admin 能設(業者送審)
        featured: canManage ? (row.featured ?? false) : undefined, tags: row.tags || [],
      };
      if (row.id) await sb.from("room_types").update(payload).eq("id", row.id);
      else await sb.from("room_types").insert(payload);
    }
    const { data } = await sb.from("room_types").select("*").eq("stay_id", stayId).order("sort").order("price");
    setRows((data as Row[]) || []);
    setBusy(false);
    if (canManage && savedCount > 0) logAdmin("save", { type: "room", id: stayId, name: stayName, detail: { 房型數: savedCount } });
    onChange?.();
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 13 }}>載入房型…</p>;

  const indexed = rows.map((r, i) => ({ r, i }));
  const singles = indexed.filter((x) => x.r.kind !== "whole");
  const wholes = indexed.filter((x) => x.r.kind === "whole");

  const extraRow = (r: Row, i: number) => (
    <div className="rt-extra">
      <span className="rt-num">加人 平日 NT$<input type="number" min={0} value={r.pricing?.extra_weekday ?? ""} placeholder="—" onChange={(e) => patchPrice(i, "extra_weekday", e.target.value)} />/人</span>
      <span className="rt-num">加人 假日 NT$<input type="number" min={0} value={r.pricing?.extra_holiday ?? ""} placeholder="—" onChange={(e) => patchPrice(i, "extra_holiday", e.target.value)} />/人</span>
    </div>
  );

  const tagsRow = (r: Row, i: number, options: string[] = ROOM_TAGS, caption?: string) => (
    <div className="rt-tags">
      {caption && <span className="rt-photos-cap">{caption}</span>}
      <div className="fac-grid">
        {options.map((t) => {
          const set = new Set(r.tags || []);
          const on = set.has(t);
          return <button type="button" key={t} className={"chip" + (on ? " on" : "")} onClick={() => { on ? set.delete(t) : set.add(t); patch(i, { tags: [...set] }); }}>{t}</button>;
        })}
      </div>
    </div>
  );

  const photosRow = (r: Row, i: number) => (
    <div className="rt-photos">
      <span className="rt-photos-cap">房型照片(可多張,第一張為封面)</span>
      <MultiImageUploader prefix="room" compact
        value={r.images && r.images.length ? r.images : (r.image ? [r.image] : [])}
        onChange={(imgs) => patch(i, { images: imgs, image: imgs[0] || "" })} />
    </div>
  );

  const togglePin = (i: number, r: Row) => {
    if (!r.featured) {
      const pinned = rows.filter((x) => x.featured).length;
      if (pinned >= roomPinQuota) {
        alert(roomPinQuota === 0 ? "目前方案不可置頂房型。請到「方案設定」調整,或把民宿升級成可置頂的方案。" : `此方案最多置頂 ${roomPinQuota} 間房型(已置頂 ${pinned} 間)。`);
        return;
      }
    }
    patch(i, { featured: !r.featured });
  };

  const toggles = (r: Row, i: number) => (
    <>
      {canManage
        ? <button type="button" className={"rt-toggle" + ((r.published ?? true) ? " on" : "")} onClick={() => patch(i, { published: !(r.published ?? true) })}>{(r.published ?? true) ? "上架中" : "已隱藏"}</button>
        : <span className="rt-review">{r.id ? (r.published ? "✅ 已上架" : "⏳ 待偶宿審核") : "⏳ 送出後待審核"}</span>}
      {allowFeatured && <button type="button" className={"rt-toggle feat" + (r.featured ? " on" : "")} onClick={() => togglePin(i, r)}>{r.featured ? "★置頂" : "置頂"}</button>}
      <button type="button" className="rt-kind-btn" onClick={() => patch(i, { kind: r.kind === "whole" ? "single" : "whole" })}>轉為{r.kind === "whole" ? "單間" : "包棟"}</button>
      <button className="lnk danger" onClick={() => removeRow(i)}>刪</button>
    </>
  );

  return (
    <div className="rt-editor">
      <div className="rt-head">
        <b>房型管理</b>
        <span className="sub">前台「起價 / 剩餘 / 人數」會自動用房型彙整;包棟以「平日」為起價{allowFeatured ? `(此方案可置頂 ${roomPinQuota} 間房型)` : ""}</span>
      </div>

      {rows.length === 0 && <div className="day-empty">還沒有房型,下方可新增「獨立單間」或「包棟方案」。</div>}

      {/* 獨立單間 */}
      <div className="rt-group-head">獨立單間 <span>{singles.length}</span></div>
      <div className="rt-list">
        {singles.map(({ r, i }) => (
          <div className="rt-item" key={r.id || "new" + i}>
            <div className="rt-row">
              <input className="rt-name" value={r.name || ""} placeholder="房型名稱(雙人房)" onChange={(e) => patch(i, { name: e.target.value })} />
              <span className="rt-num">NT$<input type="number" min={0} value={r.price ?? 0} onChange={(e) => patch(i, { price: Number(e.target.value) })} />/晚</span>
              <span className="rt-num">可住<input type="number" min={1} value={r.capacity ?? 2} onChange={(e) => patch(i, { capacity: Number(e.target.value) })} />人</span>
              <span className="rt-num">共<input type="number" min={0} value={r.rooms_total ?? ""} placeholder="—" onChange={(e) => patch(i, { rooms_total: e.target.value === "" ? null : Number(e.target.value) })} />間</span>
              {toggles(r, i)}
            </div>
            {extraRow(r, i)}
            {tagsRow(r, i, ROOM_TAGS, "房間特色")}
            {photosRow(r, i)}
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => add("single")}>＋ 新增單間房型</button>

      {/* 包棟 */}
      <div className="rt-group-head" style={{ marginTop: 22 }}>包棟方案 <span>{wholes.length}</span></div>
      <div className="rt-list">
        {wholes.map(({ r, i }) => (
          <div className="rt-item whole" key={r.id || "new" + i}>
            <div className="rt-row">
              <input className="rt-name" value={r.name || ""} placeholder="包棟方案(4~6人包棟 兩房)" onChange={(e) => patch(i, { name: e.target.value })} />
              <span className="rt-num">可住<input type="number" min={1} value={r.capacity ?? 6} onChange={(e) => patch(i, { capacity: Number(e.target.value) })} />人</span>
              <span className="rt-num">共<input type="number" min={0} value={r.rooms_total ?? ""} placeholder="—" onChange={(e) => patch(i, { rooms_total: e.target.value === "" ? null : Number(e.target.value) })} />組</span>
              {toggles(r, i)}
            </div>
            <div className="rt-prices">
              {PERIODS.map((p) => (
                <label key={p.key} className="rt-price-cell">
                  <span>{p.label}</span>
                  <span className="rt-price-in">NT$<input type="number" min={0} value={(r.pricing?.[p.key] as number | null | undefined) ?? ""} placeholder="—" onChange={(e) => patchPrice(i, p.key, e.target.value)} /></span>
                </label>
              ))}
            </div>
            <div className="rt-extras">
              {(r.pricing?.extras || []).map((ex, xi) => (
                <span className="rt-extra-cell" key={xi}>
                  <input className="rt-extra-label" value={ex.label} placeholder="名稱(例:連假)" onChange={(e) => setExtra(i, xi, "label", e.target.value)} />
                  <span className="rt-price-in">NT$<input type="number" min={0} value={ex.amount ?? ""} placeholder="—" onChange={(e) => setExtra(i, xi, "amount", e.target.value)} /></span>
                  <button type="button" className="rt-extra-del" onClick={() => delExtra(i, xi)} title="刪除此欄">×</button>
                </span>
              ))}
              <button type="button" className="rt-extra-add" onClick={() => addExtra(i)}>＋ 自訂價格欄</button>
            </div>
            {extraRow(r, i)}
            <div className="rt-includes">
              <span className="rt-photos-cap">包含哪些房間 / 說明(前台會顯示)</span>
              <textarea rows={2} value={r.includes_note || ""} placeholder="例:10人包棟提供三間雙人套房及一間四人套房" onChange={(e) => patch(i, { includes_note: e.target.value })} />
            </div>
            <div className="rt-tags">
              <span className="rt-photos-cap">包棟特色(限包棟)</span>
              <TagPalette settingKey="whole_house_options" defaults={WHOLE_HOUSE_TAGS} canManage={canManage}
                selected={new Set(r.tags || [])}
                onToggle={(t) => { const set = new Set(r.tags || []); set.has(t) ? set.delete(t) : set.add(t); patch(i, { tags: [...set] }); }} />
            </div>
            {photosRow(r, i)}
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => add("whole")}>＋ 新增包棟方案</button>

      <div style={{ display: "flex", gap: 10, marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={busy}>{busy ? "儲存中…" : "儲存房型"}</button>
      </div>
    </div>
  );
}
