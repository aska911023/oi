"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AvailabilityCalendar from "@/components/vendor/availability-calendar";

/* ---------- types ---------- */
interface Stay { id: string; name: string; booking_deposit_pct: number; booking_enabled: boolean; booking_note: string }
interface Room { id: string; stay_id: string; name: string; price: number; capacity: number; rooms_total: number | null; pricing: Record<string, unknown>; kind: string }
interface BRoom { id: string; booking_id: string; room_type_id: string | null; room_name: string; qty: number; nights: number; unit_price: number; line_total: number }
interface Payment { id: string; booking_id: string; kind: string; method: string; amount: number; received_at: string }
interface BEvent { id: string; action: string; from_status: string | null; to_status: string | null; note: string; created_at: string }
interface Booking {
  id: string; stay_id: string; code: string; source: string; status: string;
  guest_name: string; guest_phone: string; guest_email: string; adults: number; children: number;
  check_in: string; check_out: string; nights: number;
  subtotal: number; discount: number; total: number; deposit_amount: number;
  guest_note: string; staff_note: string; cancel_reason: string;
  confirmed_at: string | null; cancelled_at: string | null; created_at: string;
  booking_rooms: BRoom[]; payments: Payment[];
}

/* ---------- consts ---------- */
const STATUS: Record<string, { label: string; pill: string }> = {
  pending:    { label: "待確認", pill: "pending" },
  confirmed:  { label: "已確認", pill: "live" },
  rejected:   { label: "已拒絕", pill: "draft" },
  checked_in: { label: "已入住", pill: "feat" },
  completed:  { label: "已完成", pill: "draft" },
  cancelled:  { label: "已取消", pill: "draft" },
  no_show:    { label: "未到",   pill: "draft" },
};
const SOURCE_LABEL: Record<string, string> = { manual: "手動", web: "網站", line: "LINE", ota: "OTA" };
const PAY_KIND: Record<string, string> = { deposit: "訂金", balance: "尾款", refund: "退款" };
const PAY_METHOD: Record<string, string> = { transfer: "轉帳", cash: "現金", card: "刷卡", other: "其他" };

const money = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const nightsBetween = (ci: string, co: string) => {
  const d = (new Date(co).getTime() - new Date(ci).getTime()) / 86400000;
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
};
const genCode = () => "OI-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) => aIn < bOut && aOut > bIn;

type Line = { room_type_id: string; qty: number; unit_price: number };

/* ================================================================= */
export default function BookingsManager({ ownerId, stays: initialStays, rooms, initialBookings }:
  { ownerId: string; stays: Stay[]; rooms: Room[]; initialBookings: Booking[] }) {
  const [stays, setStays] = useState<Stay[]>(initialStays);
  const [list, setList] = useState<Booking[]>(initialBookings);
  const [tab, setTab] = useState<"pending" | "confirmed" | "today" | "all">("pending");
  const [sel, setSel] = useState<Booking | null>(null);
  const [events, setEvents] = useState<BEvent[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"orders" | "calendar" | "settings">("orders");
  const today = todayStr();

  const stayName = (id: string) => stays.find((s) => s.id === id)?.name || "—";
  const roomsOf = (stayId: string) => rooms.filter((r) => r.stay_id === stayId);

  async function refresh() {
    const sb = createClient();
    const stayIds = stays.map((s) => s.id);
    if (!stayIds.length) { setList([]); return; }
    const { data } = await sb.from("bookings").select("*, booking_rooms(*), payments(*)")
      .in("stay_id", stayIds).order("created_at", { ascending: false });
    setList((data as Booking[]) || []);
    if (sel) { const fresh = ((data as Booking[]) || []).find((b) => b.id === sel.id); setSel(fresh || null); }
  }

  /* ---- stats ---- */
  const stats = useMemo(() => {
    const monthPrefix = today.slice(0, 7);
    let received = 0;
    list.forEach((b) => b.payments?.forEach((p) => {
      if ((p.received_at || "").slice(0, 7) === monthPrefix) received += Number(p.amount) || 0;
    }));
    return {
      pending: list.filter((b) => b.status === "pending").length,
      checkIn: list.filter((b) => ["confirmed", "checked_in"].includes(b.status) && b.check_in === today).length,
      checkOut: list.filter((b) => ["checked_in", "confirmed"].includes(b.status) && b.check_out === today).length,
      received,
    };
  }, [list, today]);

  const filtered = useMemo(() => list.filter((b) => {
    if (tab === "pending") return b.status === "pending";
    if (tab === "confirmed") return b.status === "confirmed";
    if (tab === "today") return b.check_in === today || b.check_out === today;
    return true;
  }), [list, tab, today]);

  /* ---- 剩餘房數(從已載入訂單推算,排除拒絕/取消) ---- */
  function remaining(roomId: string, ci: string, co: string, excludeId?: string) {
    const room = rooms.find((r) => r.id === roomId);
    const total = room?.rooms_total ?? null;
    if (total == null) return null; // 未設總間數 → 不限制
    const active = list.filter((b) => b.id !== excludeId && ["pending", "confirmed", "checked_in"].includes(b.status) && overlaps(ci, co, b.check_in, b.check_out));
    let maxUsed = 0;
    // 逐夜取最大佔用
    for (let d = new Date(ci); d < new Date(co); d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      let used = 0;
      active.forEach((b) => {
        if (overlaps(day, new Date(new Date(day).getTime() + 86400000).toISOString().slice(0, 10), b.check_in, b.check_out))
          b.booking_rooms?.forEach((r) => { if (r.room_type_id === roomId) used += r.qty; });
      });
      if (used > maxUsed) maxUsed = used;
    }
    return total - maxUsed;
  }

  /* ---- 狀態變更 ---- */
  async function advance(b: Booking, to: string, extra: Partial<Booking> = {}, note = "") {
    setBusy(true);
    const sb = createClient();
    const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString(), ...extra };
    const { error } = await sb.from("bookings").update(patch).eq("id", b.id);
    if (!error) {
      await sb.from("booking_events").insert({ booking_id: b.id, action: to, from_status: b.status, to_status: to, actor: ownerId, note });
      if (events && sel?.id === b.id) loadEvents(b.id);
    }
    setBusy(false);
    if (error) { alert("失敗:" + error.message); return; }
    await refresh();
  }
  const doConfirm = (b: Booking) => advance(b, "confirmed", { confirmed_at: new Date().toISOString() });
  const doReject = (b: Booking) => { const r = prompt("拒絕原因(選填):") ?? ""; advance(b, "rejected", { cancel_reason: r }, r); };
  const doCheckIn = (b: Booking) => advance(b, "checked_in");
  const doCheckOut = (b: Booking) => advance(b, "completed");
  const doCancel = (b: Booking) => { if (!confirm("確定取消這筆訂單?")) return; const r = prompt("取消原因(選填):") ?? ""; advance(b, "cancelled", { cancelled_at: new Date().toISOString(), cancel_reason: r }, r); };
  const doNoShow = (b: Booking) => advance(b, "no_show");

  async function loadEvents(id: string) {
    setEvents(null);
    const sb = createClient();
    const { data } = await sb.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: true });
    setEvents((data as BEvent[]) || []);
  }
  function openDetail(b: Booking) { setSel(b); loadEvents(b.id); }

  /* ================= render ================= */
  if (!stays.length) {
    return <div className="empty" style={{ marginTop: 10 }}>你還沒有民宿,先到「我的民宿」上架,才能開始收訂房。</div>;
  }

  return (
    <>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={view === "orders" ? "on" : ""} onClick={() => setView("orders")}>📋 訂單</button>
        <button className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}>📅 房況日曆</button>
        <button className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>⚙ 訂房設定</button>
      </div>

      {view === "calendar" && <AvailabilityCalendar rooms={rooms} bookings={list} ownerId={ownerId} />}
      {view === "settings" && <SettingsPanel stays={stays} onUpdate={setStays} />}

      {view === "orders" && <>
      <div className="stats">
        <div className="stat-card"><div className="n" style={{ color: stats.pending ? "var(--accent-orange, #b4690e)" : undefined }}>{stats.pending}</div><div className="l">待確認(要處理)</div></div>
        <div className="stat-card"><div className="n">{stats.checkIn}</div><div className="l">今日入住</div></div>
        <div className="stat-card"><div className="n">{stats.checkOut}</div><div className="l">今日退房</div></div>
        <div className="stat-card"><div className="n">{money(stats.received)}</div><div className="l">本月已收(記帳)</div></div>
      </div>

      <div className="admin-bar">
        <div className="seg">
          {([["pending", `待確認${stats.pending ? " " + stats.pending : ""}`], ["confirmed", "已確認"], ["today", "今日"], ["all", "全部"]] as const).map(([v, label]) => (
            <button key={v} className={tab === v ? "on" : ""} onClick={() => setTab(v)}>{label}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ 手動建單</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>訂單</th><th>客人</th><th>入住</th><th>房型</th><th>金額</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="empty-row">這個分類沒有訂單。</td></tr>}
            {filtered.map((b) => (
              <tr key={b.id}>
                <td><b style={{ fontFamily: "var(--mono, monospace)" }}>{b.code}</b><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>{stayName(b.stay_id)} · {SOURCE_LABEL[b.source] || b.source}</span></td>
                <td>{b.guest_name || "—"}<br /><span style={{ fontSize: 11, color: "var(--muted)" }}>{b.guest_phone}</span></td>
                <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{b.check_in}<br /><span style={{ fontSize: 11, color: "var(--muted)" }}>→ {b.check_out} · {b.nights}晚</span></td>
                <td style={{ fontSize: 12.5 }}>{(b.booking_rooms || []).map((r) => `${r.room_name}×${r.qty}`).join("、") || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{money(b.total)}</td>
                <td><span className={"pill " + (STATUS[b.status]?.pill || "draft")}>{STATUS[b.status]?.label || b.status}</span></td>
                <td>
                  <div className="row-actions">
                    {b.status === "pending" && <>
                      <button className="lnk" disabled={busy} onClick={() => doConfirm(b)}>確認</button>
                      <button className="lnk danger" disabled={busy} onClick={() => doReject(b)}>拒絕</button>
                    </>}
                    <button className="lnk" onClick={() => openDetail(b)}>詳情</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && <DetailDrawer b={sel} stayName={stayName(sel.stay_id)} events={events} busy={busy}
        onClose={() => { setSel(null); setEvents(null); }}
        onConfirm={() => doConfirm(sel)} onReject={() => doReject(sel)} onCheckIn={() => doCheckIn(sel)}
        onCheckOut={() => doCheckOut(sel)} onCancel={() => doCancel(sel)} onNoShow={() => doNoShow(sel)}
        onPaid={refresh} ownerId={ownerId} />}

      {showCreate && <CreateModal stays={stays} roomsOf={roomsOf} remaining={remaining} ownerId={ownerId}
        onClose={() => setShowCreate(false)} onDone={async () => { setShowCreate(false); await refresh(); }} />}
      </>}
    </>
  );
}

/* ================= 詳情抽屜 ================= */
function DetailDrawer({ b, stayName, events, busy, onClose, onConfirm, onReject, onCheckIn, onCheckOut, onCancel, onNoShow, onPaid, ownerId }: {
  b: Booking; stayName: string; events: BEvent[] | null; busy: boolean; onClose: () => void;
  onConfirm: () => void; onReject: () => void; onCheckIn: () => void; onCheckOut: () => void; onCancel: () => void; onNoShow: () => void;
  onPaid: () => void; ownerId: string;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const paid = (b.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const s = STATUS[b.status];

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="editor" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {b.guest_name || "訂單"} <span className={"pill " + (s?.pill || "draft")}>{s?.label}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono,monospace)", fontSize: 13, color: "var(--muted)" }}>{b.code}</span>
        </h2>

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13.5 }}>
          <div><label>民宿</label><div>{stayName}</div></div>
          <div><label>來源</label><div>{SOURCE_LABEL[b.source] || b.source}</div></div>
          <div><label>電話</label><div>{b.guest_phone || "—"}</div></div>
          <div><label>Email</label><div>{b.guest_email || "—"}</div></div>
          <div><label>入住 → 退房</label><div>{b.check_in} → {b.check_out} · {b.nights}晚</div></div>
          <div><label>人數</label><div>{b.adults} 大 {b.children ? `/ ${b.children} 小` : ""}</div></div>
        </div>
        {b.guest_note && <p style={{ fontSize: 13, margin: "10px 0 0" }}><b>客人需求:</b>{b.guest_note}</p>}

        <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <table className="atable" style={{ fontSize: 13 }}>
            <thead><tr><th>房型</th><th>間</th><th>晚</th><th>單價</th><th>小計</th></tr></thead>
            <tbody>
              {(b.booking_rooms || []).map((r) => (
                <tr key={r.id}><td>{r.room_name}</td><td>{r.qty}</td><td>{r.nights}</td><td>{money(r.unit_price)}</td><td>{money(r.line_total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, background: "var(--bg-secondary, var(--surface-2))", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>合計</span><b>{money(b.total)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary,var(--ink-2))" }}><span>應收訂金</span><span>{money(b.deposit_amount)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-green,#2f8a58)" }}><span>已收</span><span>{money(paid)}</span></div>
        </div>
        {(b.payments || []).length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
            {b.payments.map((p) => <div key={p.id}>{PAY_KIND[p.kind]} · {PAY_METHOD[p.method]} {money(p.amount)}<span style={{ marginLeft: 8 }}>{(p.received_at || "").slice(0, 10)}</span></div>)}
          </div>
        )}

        {/* 動作 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {b.status === "pending" && <>
            <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>確認訂房</button>
            <button className="btn btn-ghost" disabled={busy} onClick={onReject}>拒絕</button>
          </>}
          {b.status === "confirmed" && <>
            <button className="btn btn-primary" disabled={busy} onClick={onCheckIn}>報到(入住)</button>
            <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>取消</button>
            <button className="btn btn-ghost" disabled={busy} onClick={onNoShow}>未到</button>
          </>}
          {b.status === "checked_in" && <button className="btn btn-primary" disabled={busy} onClick={onCheckOut}>退房(完成)</button>}
          {["pending", "confirmed", "checked_in"].includes(b.status) && <button className="btn btn-ghost" onClick={() => setPayOpen(true)}>記錄收款</button>}
        </div>

        {payOpen && <PayForm bookingId={b.id} ownerId={ownerId} defaultAmount={Math.max(0, b.deposit_amount - paid)}
          onClose={() => setPayOpen(false)} onDone={() => { setPayOpen(false); onPaid(); }} />}

        {/* 時間軸 */}
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>狀態軌跡</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {events === null ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>載入中…</span>
              : events.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>建立於 {new Date(b.created_at).toLocaleString("zh-TW")}</span>
              : events.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)", fontFamily: "var(--mono,monospace)", whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{STATUS[e.to_status || ""]?.label || e.action}{e.note ? ` · ${e.note}` : ""}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="editor-actions"><button className="btn btn-ghost" onClick={onClose}>關閉</button></div>
      </div>
    </>
  );
}

/* ================= 記錄收款 ================= */
function PayForm({ bookingId, ownerId, defaultAmount, onClose, onDone }: { bookingId: string; ownerId: string; defaultAmount: number; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState("deposit");
  const [method, setMethod] = useState("transfer");
  const [amount, setAmount] = useState(defaultAmount || 0);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("payments").insert({ booking_id: bookingId, kind, method, amount: Number(amount) || 0, recorded_by: ownerId });
    setBusy(false);
    if (error) { alert("失敗:" + error.message); return; }
    onDone();
  }
  return (
    <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div><label style={{ fontSize: 12 }}>類別</label><br /><select value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(PAY_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label style={{ fontSize: 12 }}>方式</label><br /><select value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label style={{ fontSize: 12 }}>金額</label><br /><input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 100 }} /></div>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>記錄</button>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
    </div>
  );
}

/* ================= 手動建單 ================= */
function CreateModal({ stays, roomsOf, remaining, ownerId, onClose, onDone }: {
  stays: Stay[]; roomsOf: (id: string) => Room[]; remaining: (roomId: string, ci: string, co: string, ex?: string) => number | null;
  ownerId: string; onClose: () => void; onDone: () => void;
}) {
  const [stayId, setStayId] = useState(stays[0]?.id || "");
  const stay = stays.find((s) => s.id === stayId);
  const roomList = roomsOf(stayId);
  const [ci, setCi] = useState(todayStr());
  const [co, setCo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [guestNote, setGuestNote] = useState("");
  const [depositPaid, setDepositPaid] = useState(0);
  const [confirmNow, setConfirmNow] = useState(true);
  const [busy, setBusy] = useState(false);

  const nights = nightsBetween(ci, co);
  const subtotal = lines.reduce((a, l) => a + (Number(l.unit_price) || 0) * (Number(l.qty) || 0) * nights, 0);
  const total = subtotal;
  const depositPct = stay?.booking_deposit_pct ?? 30;
  const deposit = Math.round(total * depositPct / 100);

  function addLine() {
    const r = roomList[0];
    if (!r) { alert("這間民宿還沒有房型,先到「我的民宿」新增房型。"); return; }
    setLines([...lines, { room_type_id: r.id, qty: 1, unit_price: r.price || 0 }]);
  }
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => k === i ? { ...l, ...patch } : l));
  const rmLine = (i: number) => setLines(lines.filter((_, k) => k !== i));

  async function save() {
    if (!stayId) { alert("請選民宿"); return; }
    if (nights <= 0) { alert("退房日要晚於入住日"); return; }
    if (!lines.length) { alert("請至少加一個房型"); return; }
    setBusy(true);
    const sb = createClient();
    const status = confirmNow ? "confirmed" : "pending";
    const { data: bk, error } = await sb.from("bookings").insert({
      stay_id: stayId, code: genCode(), source: "manual", status,
      guest_name: guestName.trim(), guest_phone: guestPhone.trim(), guest_email: guestEmail.trim(),
      adults: Number(adults) || 1, children: Number(children) || 0,
      check_in: ci, check_out: co, subtotal, discount: 0, total, deposit_amount: deposit,
      guest_note: guestNote.trim(), created_by: ownerId,
      confirmed_at: confirmNow ? new Date().toISOString() : null,
    }).select("id").single();
    if (error || !bk) { setBusy(false); alert("建立失敗:" + (error?.message || "")); return; }
    const rowsIns = lines.map((l) => {
      const r = roomList.find((x) => x.id === l.room_type_id);
      return { booking_id: bk.id, room_type_id: l.room_type_id, room_name: r?.name || "", qty: Number(l.qty) || 1, nights, unit_price: Number(l.unit_price) || 0, line_total: (Number(l.unit_price) || 0) * (Number(l.qty) || 1) * nights };
    });
    await sb.from("booking_rooms").insert(rowsIns);
    await sb.from("booking_events").insert({ booking_id: bk.id, action: "created", to_status: status, actor: ownerId, note: "手動建單" });
    if (Number(depositPaid) > 0) await sb.from("payments").insert({ booking_id: bk.id, kind: "deposit", method: "transfer", amount: Number(depositPaid), recorded_by: ownerId });
    setBusy(false);
    onDone();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="editor" role="dialog" aria-modal="true" style={{ maxWidth: 600 }}>
        <h2>手動建單 <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>電話 / 走客訂房</span></h2>
        <div className="form-grid">
          <div><label>民宿</label><select value={stayId} onChange={(e) => { setStayId(e.target.value); setLines([]); }}>{stays.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label>入住</label><input type="date" value={ci} onChange={(e) => setCi(e.target.value)} /></div>
          <div><label>退房</label><input type="date" value={co} onChange={(e) => setCo(e.target.value)} /></div>
          <div><label>客人姓名</label><input value={guestName} onChange={(e) => setGuestName(e.target.value)} /></div>
          <div><label>電話</label><input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} /></div>
          <div><label>Email</label><input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} /></div>
          <div><label>大人</label><input type="number" value={adults} onChange={(e) => setAdults(Number(e.target.value))} /></div>
          <div><label>小孩</label><input type="number" value={children} onChange={(e) => setChildren(Number(e.target.value))} /></div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>房型({nights} 晚)</label>
          {lines.map((l, i) => {
            const rem = remaining(l.room_type_id, ci, co);
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                <select value={l.room_type_id} onChange={(e) => { const r = roomList.find((x) => x.id === e.target.value); setLine(i, { room_type_id: e.target.value, unit_price: r?.price || 0 }); }}>
                  {roomList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="number" value={l.qty} min={1} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} style={{ width: 56 }} title="間數" />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>×</span>
                <input type="number" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} style={{ width: 90 }} title="單價/晚" />
                {rem != null && <span className="pill" style={{ background: rem >= l.qty ? "var(--accent-green-dim,#d6f0df)" : "var(--accent-red-dim,#f6ddd9)", color: rem >= l.qty ? "var(--accent-green,#2f8a58)" : "var(--accent-red,#c0564f)" }}>尚有 {rem} 間</span>}
                <button className="lnk danger" onClick={() => rmLine(i)}>刪</button>
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addLine}>＋ 加房型</button>
        </div>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="wide"><label>客人需求 / 備註</label><input value={guestNote} onChange={(e) => setGuestNote(e.target.value)} /></div>
        </div>

        <div style={{ marginTop: 12, background: "var(--bg-secondary,var(--surface-2))", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>合計</span><b>{money(total)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary,var(--ink-2))" }}><span>應收訂金({depositPct}%)</span><span>{money(deposit)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>已收訂金(現場/轉帳)</span>
            <input type="number" value={depositPaid} onChange={(e) => setDepositPaid(Number(e.target.value))} style={{ width: 110 }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
          <label className="check"><input type="checkbox" checked={confirmNow} onChange={(e) => setConfirmNow(e.target.checked)} /> 建立並直接確認</label>
        </div>
        <div className="editor-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "建立中…" : "建立訂單"}</button>
        </div>
      </div>
    </>
  );
}

/* ================= 訂房設定(每店可改,不寫死) ================= */
function SettingsPanel({ stays, onUpdate }: { stays: Stay[]; onUpdate: (s: Stay[]) => void }) {
  const [draft, setDraft] = useState<Stay[]>(stays);
  const [savingId, setSavingId] = useState<string | null>(null);
  const setField = (id: string, patch: Partial<Stay>) => setDraft((d) => d.map((s) => s.id === id ? { ...s, ...patch } : s));

  async function save(s: Stay) {
    setSavingId(s.id);
    const sb = createClient();
    const { error } = await sb.from("stays").update({
      booking_enabled: s.booking_enabled,
      booking_deposit_pct: Math.max(0, Math.min(100, Number(s.booking_deposit_pct) || 0)),
      booking_note: (s.booking_note || "").trim(),
    }).eq("id", s.id);
    setSavingId(null);
    if (error) { alert("儲存失敗:" + error.message); return; }
    onUpdate(draft); // 同步上層,讓手動建單用新的訂金%
  }

  if (!draft.length) return <div className="empty">沒有民宿可設定。</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--muted,#808b83)", margin: 0 }}>每間民宿可各自設定。訂金比例會用在手動建單自動算應收訂金;關閉「啟用訂房」= 這間先不收訂房(前台上線後也不會顯示)。</p>
      {draft.map((s) => (
        <div key={s.id} style={{ border: "1px solid var(--border,#e1e6dc)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <b style={{ fontSize: 15 }}>{s.name}</b>
            <label className="check" style={{ marginLeft: "auto" }}>
              <input type="checkbox" checked={s.booking_enabled} onChange={(e) => setField(s.id, { booking_enabled: e.target.checked })} /> 啟用訂房
            </label>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted,#808b83)" }}>訂金比例(%)</label><br />
              <input type="number" min={0} max={100} value={s.booking_deposit_pct}
                onChange={(e) => setField(s.id, { booking_deposit_pct: Number(e.target.value) })} style={{ width: 90 }} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 12, color: "var(--muted,#808b83)" }}>訂房須知 / 確認訊息</label><br />
              <input value={s.booking_note || ""} placeholder="例:訂金請於 3 日內匯款,逾期取消…"
                onChange={(e) => setField(s.id, { booking_note: e.target.value })} style={{ width: "100%" }} />
            </div>
            <button className="btn btn-primary btn-sm" disabled={savingId === s.id} onClick={() => save(s)}>{savingId === s.id ? "儲存中…" : "儲存"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
