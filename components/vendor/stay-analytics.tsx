"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Data {
  days: number; views: number; clicks_web: number; clicks_line: number; clicks_map: number;
  saves: number; bookings: number; completed: number; prev_views: number; prev_bookings: number;
  revenue_booked: number; deposit_booked: number;
  status: Record<string, number>; daily: { d: string; views: number; bookings: number }[];
}
const STATUS_LABEL: Record<string, string> = {
  pending: "待確認", confirmed: "待匯訂金", deposit_reported: "待核對訂金", booked: "訂房完成",
  rejected: "未成立", cancelled: "已取消", checked_in: "已入住", completed: "已完成", no_show: "未到",
};

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return cur > 0 ? <span style={{ color: "var(--green)", fontSize: 12 }}>▲ 新增</span> : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span style={{ color: "var(--muted)", fontSize: 12 }}>持平</span>;
  const up = pct > 0;
  return <span style={{ color: up ? "var(--green)" : "var(--accent-red,#c0392b)", fontSize: 12 }}>{up ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

export default function StayAnalytics({ stays }: { stays: { id: string; name: string }[] }) {
  const [sid, setSid] = useState(stays[0]?.id || "");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    setLoading(true);
    createClient().rpc("stay_analytics", { p_stay_id: sid, p_days: days }).then(({ data }) => {
      if (alive) { setData(data as Data); setLoading(false); }
    });
    return () => { alive = false; };
  }, [sid, days]);

  const clicks = data ? data.clicks_web + data.clicks_line + data.clicks_map : 0;
  const conv = data && data.views > 0 ? (data.bookings / data.views) * 100 : 0;
  const maxDaily = useMemo(() => (data ? Math.max(1, ...data.daily.map((x) => x.views)) : 1), [data]);

  if (stays.length === 0) return <div className="empty" style={{ marginTop: 16 }}>你還沒有民宿,無法顯示數據。</div>;

  const card = (label: string, value: React.ReactNode, extra?: React.ReactNode) => (
    <div className="stat-card"><div className="n">{value}</div><div className="l">{label}</div>{extra && <div style={{ marginTop: 2 }}>{extra}</div>}</div>
  );

  return (
    <>
      <div className="admin-bar" style={{ alignItems: "center" }}>
        <select value={sid} onChange={(e) => setSid(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface,#fff)", maxWidth: 280 }}>
          {stays.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="seg">
          {[30, 90].map((d) => <button key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>近 {d} 天</button>)}
        </div>
      </div>

      {loading || !data ? <div style={{ padding: 30, color: "var(--muted)" }}>載入中…</div> : (
        <>
          <div className="stats">
            {card("瀏覽", data.views.toLocaleString(), <Delta cur={data.views} prev={data.prev_views} />)}
            {card("聯繫點擊", clicks.toLocaleString(), <span style={{ fontSize: 11, color: "var(--muted)" }}>官網{data.clicks_web}·LINE{data.clicks_line}·地圖{data.clicks_map}</span>)}
            {card("收藏", data.saves.toLocaleString())}
            {card("訂房", data.bookings.toLocaleString(), <Delta cur={data.bookings} prev={data.prev_bookings} />)}
            {card("成交", data.completed.toLocaleString())}
            {card("轉換率", (conv ? conv.toFixed(1) : "0") + "%")}
          </div>

          {/* 轉換漏斗 */}
          <div className="shop-block" style={{ marginTop: 8 }}>
            <h3 className="serif shop-h" style={{ fontSize: 17 }}>轉換漏斗</h3>
            {[
              { k: "瀏覽", v: data.views, c: "#1b7366" },
              { k: "互動(點擊+收藏)", v: clicks + data.saves, c: "#2f8a58" },
              { k: "訂房", v: data.bookings, c: "#b4690e" },
              { k: "成交", v: data.completed, c: "#0f4a42" },
            ].map((row) => {
              const base = Math.max(1, data.views);
              return (
                <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 12, margin: "7px 0" }}>
                  <span style={{ width: 130, fontSize: 13.5, color: "var(--text-2)" }}>{row.k}</span>
                  <div style={{ flex: 1, background: "var(--surface-2,#eef2f0)", borderRadius: 6, overflow: "hidden", height: 22 }}>
                    <div style={{ width: `${Math.max(2, (row.v / base) * 100)}%`, background: row.c, height: "100%", borderRadius: 6, transition: "width .4s" }} />
                  </div>
                  <b style={{ width: 54, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.v.toLocaleString()}</b>
                </div>
              );
            })}
          </div>

          {/* 每日趨勢 */}
          <div className="shop-block" style={{ marginTop: 8 }}>
            <h3 className="serif shop-h" style={{ fontSize: 17 }}>每日趨勢(瀏覽)</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 110, overflowX: "auto", paddingTop: 6 }}>
              {data.daily.map((x, i) => (
                <div key={i} title={`${x.d}:瀏覽 ${x.views}、訂房 ${x.bookings}`} style={{ flex: "1 0 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 6 }}>
                  <div style={{ width: "100%", background: "var(--green)", borderRadius: "3px 3px 0 0", height: `${(x.views / maxDaily) * 90}px`, minHeight: x.views ? 2 : 0 }} />
                  {x.bookings > 0 && <div style={{ width: "100%", background: "#b4690e", height: `${Math.min(x.bookings * 8, 20)}px`, borderRadius: 2 }} title={`訂房 ${x.bookings}`} />}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>綠=瀏覽、橘=訂房。滑過看單日數字。</div>
          </div>

          {/* 訂房狀態 + 營收 */}
          <div className="shop-block" style={{ marginTop: 8 }}>
            <h3 className="serif shop-h" style={{ fontSize: 17 }}>訂房狀態</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {Object.entries(data.status).length === 0 ? <span style={{ color: "var(--muted)", fontSize: 14 }}>目前沒有訂房紀錄。</span>
                : Object.entries(data.status).map(([k, v]) => (
                  <span key={k} className="pill draft" style={{ fontSize: 13 }}>{STATUS_LABEL[k] || k} {v}</span>
                ))}
            </div>
            <div style={{ fontSize: 14 }}>成交營收 <b style={{ color: "var(--green)" }}>NT$ {Number(data.revenue_booked).toLocaleString()}</b>　已收訂金 <b>NT$ {Number(data.deposit_booked).toLocaleString()}</b></div>
          </div>
        </>
      )}
    </>
  );
}
