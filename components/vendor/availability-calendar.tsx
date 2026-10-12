"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Room { id: string; stay_id: string; name: string; price: number; rooms_total: number | null; pricing: Record<string, unknown>; kind: string }
interface BRoom { room_type_id: string | null; qty: number }
interface Booking { status: string; check_in: string; check_out: string; booking_rooms: BRoom[] }
interface AvailRow { room_type_id: string; date: string; inventory: number | null; closed: boolean; price_override: number | null; note: string }

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const money = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString();
const WD = ["日", "一", "二", "三", "四", "五", "六"];

export default function AvailabilityCalendar({ rooms, bookings, ownerId }:
  { rooms: Room[]; bookings: Booking[]; ownerId: string }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth()); // 0-11
  const [avail, setAvail] = useState<Record<string, AvailRow>>({});
  const [edit, setEdit] = useState<{ date: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [bStart, setBStart] = useState("");
  const [bEnd, setBEnd] = useState("");
  const [bBusy, setBBusy] = useState(false);

  const room = rooms.find((r) => r.id === roomId);
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  async function load() {
    if (!roomId) return;
    setLoading(true);
    const sb = createClient();
    const start = ymd(y, m, 1), end = ymd(y, m, daysInMonth);
    const { data } = await sb.from("room_availability").select("*")
      .eq("room_type_id", roomId).gte("date", start).lte("date", end);
    const map: Record<string, AvailRow> = {};
    ((data as AvailRow[]) || []).forEach((r) => { map[r.date] = r; });
    setAvail(map);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [roomId, y, m]);

  function prevMonth() { if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1); }
  function nextMonth() { if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1); }

  // 批次:把一段日期全部關房 / 開放(保留既有庫存、價格覆寫)
  async function applyRange(action: "close" | "open") {
    if (!roomId) return;
    if (!bStart || !bEnd || bEnd < bStart) { alert("請選有效的日期區間"); return; }
    setBBusy(true);
    const sb = createClient();
    const { data } = await sb.from("room_availability").select("*")
      .eq("room_type_id", roomId).gte("date", bStart).lte("date", bEnd);
    const ex: Record<string, AvailRow> = {};
    ((data as AvailRow[]) || []).forEach((r) => { ex[r.date] = r; });
    const ups: AvailRow[] = [];
    const dels: string[] = [];
    for (let d = new Date(bStart); d <= new Date(bEnd); d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const cur = ex[date];
      const inv = cur?.inventory ?? null, pr = cur?.price_override ?? null, nt = cur?.note ?? "";
      if (action === "close") {
        ups.push({ room_type_id: roomId, date, inventory: inv, closed: true, price_override: pr, note: nt });
      } else if (inv == null && pr == null && !nt) {
        dels.push(date); // 開放後全預設 → 刪列
      } else {
        ups.push({ room_type_id: roomId, date, inventory: inv, closed: false, price_override: pr, note: nt });
      }
    }
    if (ups.length) await sb.from("room_availability").upsert(ups, { onConflict: "room_type_id,date" });
    if (dels.length) await sb.from("room_availability").delete().eq("room_type_id", roomId).in("date", dels);
    setBBusy(false);
    await load();
  }

  // 依星期推價:週五六 = 假日價,其餘平日;可被 price_override 覆寫
  const pnum = (k: string): number | null => { const v = (room?.pricing as Record<string, unknown>)?.[k]; return typeof v === "number" ? v : null; };
  function basePrice(date: string): number {
    const dow = new Date(date).getDay();
    if (dow === 5 || dow === 6) return pnum("holiday") ?? pnum("weekday") ?? room?.price ?? 0;
    return pnum("weekday") ?? room?.price ?? 0;
  }
  function effPrice(date: string): number {
    const o = avail[date];
    return o?.price_override != null ? o.price_override : basePrice(date);
  }

  // 當日已佔用(待確認/已確認/已入住)
  const occByDate = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      if (!["pending", "confirmed", "checked_in"].includes(b.status)) return;
      const q = (b.booking_rooms || []).filter((r) => r.room_type_id === roomId).reduce((a, r) => a + (r.qty || 0), 0);
      if (!q) return;
      for (let d = new Date(b.check_in); d < new Date(b.check_out); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        map[key] = (map[key] || 0) + q;
      }
    });
    return map;
  }, [bookings, roomId]);

  function invOf(date: string): number | null {
    const o = avail[date];
    const base = o?.inventory != null ? o.inventory : (room?.rooms_total ?? null);
    return base;
  }
  function remainOf(date: string): number | null {
    const inv = invOf(date);
    if (inv == null) return null;
    return inv - (occByDate[date] || 0);
  }

  if (!rooms.length) return <div className="empty" style={{ marginTop: 10 }}>還沒有房型,先到「我的民宿」新增房型,才能設定房況。</div>;

  const cellBorder = "1px solid var(--border,#e1e6dc)";

  return (
    <>
      <div className="admin-bar" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ maxWidth: 260 }}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.rooms_total != null ? `(共${r.rooms_total}間)` : ""}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
          <b style={{ fontVariantNumeric: "tabular-nums", minWidth: 96, textAlign: "center" }}>{y} 年 {m + 1} 月</b>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setY(now.getFullYear()); setM(now.getMonth()); }}>今天</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 12px", fontSize: 13 }}>
        <span style={{ color: "var(--muted,#808b83)" }}>批次:</span>
        <input type="date" value={bStart} onChange={(e) => setBStart(e.target.value)} />
        <span style={{ color: "var(--muted,#808b83)" }}>→</span>
        <input type="date" value={bEnd} onChange={(e) => setBEnd(e.target.value)} />
        <button className="btn btn-ghost btn-sm" disabled={bBusy} onClick={() => applyRange("close")}>整段關房</button>
        <button className="btn btn-ghost btn-sm" disabled={bBusy} onClick={() => applyRange("open")}>整段開放</button>
        <span style={{ color: "var(--muted,#808b83)", fontSize: 12 }}>(保留既有庫存/價格覆寫,只改關房狀態)</span>
      </div>

      <div style={{ border: cellBorder, borderRadius: 10, overflow: "hidden", opacity: loading ? 0.6 : 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {WD.map((w, i) => <div key={w} style={{ textAlign: "center", fontSize: 11.5, color: i === 0 || i === 6 ? "var(--accent-red,#c0564f)" : "var(--muted,#808b83)", padding: "7px 0", borderBottom: cellBorder, fontWeight: 700 }}>{w}</div>)}
          {Array.from({ length: firstDow }).map((_, i) => <div key={"b" + i} style={{ borderRight: cellBorder, borderBottom: cellBorder, minHeight: 66, background: "var(--bg-secondary,#f3f6f1)" }} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = ymd(y, m, day);
            const o = avail[date];
            const closed = !!o?.closed;
            const rem = remainOf(date);
            const full = rem != null && rem <= 0;
            const overridden = o && (o.price_override != null || o.inventory != null);
            return (
              <div key={date} onClick={() => setEdit({ date })} title="點擊編輯"
                style={{
                  borderRight: cellBorder, borderBottom: cellBorder, minHeight: 66, padding: "4px 6px",
                  display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", fontSize: 11,
                  background: closed ? "var(--accent-red-dim,#f6ddd9)" : full ? "var(--bg-secondary,#eef1ea)" : "transparent",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted,#808b83)", fontWeight: 700 }}>{day}</span>
                  {overridden && !closed && <span title="已覆寫" style={{ color: "var(--accent-cyan,#1d6a56)", fontSize: 10 }}>●</span>}
                </div>
                <span style={{ fontWeight: 800, fontSize: 12, color: closed ? "var(--accent-red,#c0564f)" : full ? "var(--muted,#808b83)" : "var(--accent-green,#2f8a58)" }}>
                  {closed ? "關房" : rem == null ? "—" : `餘 ${rem}`}
                </span>
                <span style={{ color: "var(--text-secondary,#47554e)", fontFamily: "var(--mono,monospace)", fontSize: 10 }}>{closed ? "" : money(effPrice(date))}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted,#808b83)", marginTop: 8 }}>
        綠「餘 N」=剩餘可售(總間數−已佔用);紅=關房;青點=當日已覆寫庫存/價。價格預設週五六吃假日價、其餘平日價,可逐日覆寫。點格子編輯。
      </p>

      {edit && room && <CellEditor room={room} date={edit.date} row={avail[edit.date]} basePrice={basePrice(edit.date)} ownerId={ownerId}
        onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await load(); }} />}
    </>
  );
}

/* ---------- 單格編輯 ---------- */
function CellEditor({ room, date, row, basePrice, onClose, onSaved }: {
  room: Room; date: string; row?: AvailRow; basePrice: number; ownerId: string; onClose: () => void; onSaved: () => void;
}) {
  const [closed, setClosed] = useState(!!row?.closed);
  const [inv, setInv] = useState<string>(row?.inventory != null ? String(row.inventory) : "");
  const [price, setPrice] = useState<string>(row?.price_override != null ? String(row.price_override) : "");
  const [note, setNote] = useState(row?.note || "");
  const [busy, setBusy] = useState(false);

  const isDefault = !closed && inv === "" && price === "" && !note.trim();

  async function save() {
    setBusy(true);
    const sb = createClient();
    if (isDefault) {
      // 全預設 → 刪掉覆寫列(保持 sparse)
      await sb.from("room_availability").delete().eq("room_type_id", room.id).eq("date", date);
    } else {
      await sb.from("room_availability").upsert({
        room_type_id: room.id, date,
        inventory: inv === "" ? null : Number(inv),
        closed, price_override: price === "" ? null : Number(price),
        note: note.trim(), updated_at: new Date().toISOString(),
      }, { onConflict: "room_type_id,date" });
    }
    setBusy(false);
    onSaved();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="editor" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
        <h2 style={{ fontSize: 18 }}>{date} · {room.name}</h2>
        <label className="check" style={{ marginTop: 6 }}><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> 關房(不可售,維修/自住/客滿)</label>
        {!closed && (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div><label>當日可售間數</label><input type="number" value={inv} placeholder={`預設 ${room.rooms_total ?? "不限"}`} onChange={(e) => setInv(e.target.value)} /></div>
            <div><label>當日房價</label><input type="number" value={price} placeholder={`預設 ${money(basePrice)}`} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="wide"><label>備註</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="關房原因 / 特殊說明" /></div>
          </div>
        )}
        <p style={{ fontSize: 12.5, color: "var(--muted,#808b83)", marginTop: 10 }}>留空 = 用預設(總間數 / 依星期的價格)。清空全部並儲存即恢復預設。</p>
        <div className="editor-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "儲存中…" : "儲存"}</button>
        </div>
      </div>
    </>
  );
}
