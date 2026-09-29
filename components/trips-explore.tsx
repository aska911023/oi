"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { TRANSPORTS, type Trip } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const PAGE = 24;
const dayRange = (b: string): [number | null, number | null] => b === "1-2" ? [1, 2] : b === "3-4" ? [3, 4] : b === "5+" ? [5, null] : [null, null];
const headRange = (b: string): [number | null, number | null] => b === "1-2" ? [1, 2] : b === "3-4" ? [3, 4] : b === "5+" ? [5, null] : [null, null];
const DAY_BUCKETS = [
  { v: "all", label: "不限天數" },
  { v: "1-2", label: "1–2 天" },
  { v: "3-4", label: "3–4 天" },
  { v: "5+", label: "5 天以上" },
];
const BUDGET_BUCKETS = [
  { v: "all", label: "不限預算" },
  { v: "3000", label: "每人 ≤ 3,000" },
  { v: "6000", label: "每人 ≤ 6,000" },
  { v: "10000", label: "每人 ≤ 10,000" },
];
const HEAD_BUCKETS = [
  { v: "all", label: "不限人數" },
  { v: "1-2", label: "1–2 人" },
  { v: "3-4", label: "3–4 人" },
  { v: "5+", label: "5 人以上" },
];

export default function TripsExplore({ initialTrips, initialTotal }: { initialTrips: Trip[]; initialTotal: number }) {
  const [kw, setKw] = useState("");
  const [dayB, setDayB] = useState("all");
  const [budgetB, setBudgetB] = useState("all");
  const [headB, setHeadB] = useState("all");
  const [transport, setTransport] = useState("all");
  const [region, setRegion] = useState("all");

  const [rows, setRows] = useState<Trip[]>(initialTrips);
  const [rpcTotal, setRpcTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  function args(off: number) {
    const [dMin, dMax] = dayRange(dayB);
    const [hMin, hMax] = headRange(headB);
    return {
      kw: kw.trim(), p_days_min: dMin, p_days_max: dMax,
      p_budget_max: budgetB === "all" ? null : Number(budgetB),
      p_head_min: hMin, p_head_max: hMax,
      p_transport: transport === "all" ? null : transport,
      p_region: region === "all" ? null : region, lim: PAGE, off,
    };
  }

  async function fetchPage(off: number, append: boolean) {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.rpc("search_trips", args(off));
    const newRows = (data?.rows || []) as Trip[];
    setRpcTotal(data?.total ?? 0);
    setRows((prev) => (append ? [...prev, ...newRows] : newRows));
    setLoading(false);
  }

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { fetchPage(0, false); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, dayB, budgetB, headB, transport, region]);

  const results = rows;
  const canLoadMore = rows.length < rpcTotal;

  return (
    <>
      <div className="trips-filter">
        <input className="admin-search" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋行程名稱、地區…" />
        <select value={dayB} onChange={(e) => setDayB(e.target.value)}>{DAY_BUCKETS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}</select>
        <select value={budgetB} onChange={(e) => setBudgetB(e.target.value)}>{BUDGET_BUCKETS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}</select>
        <select value={headB} onChange={(e) => setHeadB(e.target.value)}>{HEAD_BUCKETS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}</select>
        <select value={transport} onChange={(e) => setTransport(e.target.value)}><option value="all">不限交通</option>{TRANSPORTS.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={region} onChange={(e) => setRegion(e.target.value)}><option value="all">不限地區</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
      </div>

      <div className="sec-head"><div className="st"><h2 className="serif">公開行程</h2><span className="count">{rpcTotal} 筆</span></div></div>

      <div className="trips-grid">
        {results.length === 0 && <div className="empty">還沒有符合條件的行程。放寬篩選,或自己<Link href="/plan" style={{ color: "var(--green)", textDecoration: "underline" }}>規劃一個</Link>並公開分享。</div>}
        {results.map((t) => (
          <Link key={t.id} href={`/trips/${t.id}`} className="trip-card">
            <div className="trip-card-top">
              <h3>{t.title}</h3>
              <span className="trip-days">{t.days} 天</span>
            </div>
            {t.summary && <p className="trip-sum">{t.summary}</p>}
            <div className="trip-tags">
              <span>{t.headcount} 人</span>
              {t.transport && <span>{t.transport}</span>}
              {t.budget != null && <span>每人 NT${t.budget.toLocaleString()}</span>}
              {t.region && <span>{t.region}</span>}
              <span>{t.items?.length || 0} 個點</span>
            </div>
          </Link>
        ))}
      </div>
      {canLoadMore && (
        <div style={{ textAlign: "center", marginTop: 30 }}>
          <button className="btn btn-ghost" onClick={() => fetchPage(rows.length, true)} disabled={loading}>
            {loading ? "載入中…" : `載入更多(${rows.length}/${rpcTotal})`}
          </button>
        </div>
      )}
    </>
  );
}
