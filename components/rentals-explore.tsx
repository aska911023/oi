"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { priceLabel } from "@/lib/data";
import { POI_KINDS, type RentalShop, type RentalPlan } from "@/lib/types";

const TAB_LABEL: Record<string, string> = { attraction: "景點", food: "美食", parking: "停車" };

const PAGE = 24;
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M7 17L17 7M9 7h8v8" /></svg>,
  map: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>,
  car: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M5 11l2-5h10l2 5M4 11h16v5H4zM7 16v2M17 16v2" /><circle cx="7.5" cy="13.5" r="1" /><circle cx="16.5" cy="13.5" r="1" /></svg>,
};

export default function RentalsExplore({ shops, total = 0 }: { shops: RentalShop[]; total?: number }) {
  const [kw, setKw] = useState("");
  const [region, setRegion] = useState("all");
  const [rows, setRows] = useState<RentalShop[]>(shops);
  const [rpcTotal, setRpcTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);
  const [active, setActive] = useState<RentalShop | null>(null);
  const [plans, setPlans] = useState<RentalPlan[]>([]);

  async function load(kwv: string, regionv: string, off: number, append: boolean) {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.rpc("search_rentals", { kw: kwv.trim(), p_region: regionv === "all" ? null : regionv, lim: PAGE, off });
    const newRows = (data?.rows || []) as RentalShop[];
    setRpcTotal(data?.total ?? 0);
    setRows((prev) => (append ? [...prev, ...newRows] : newRows));
    setLoading(false);
  }

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { load(kw, region, 0, false); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, region]);

  useEffect(() => {
    if (!active) { setPlans([]); return; }
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("rental_plans").select("*").eq("shop_id", active.id).eq("published", true).order("sort").order("price_per_day");
      if (alive) setPlans((data as RentalPlan[]) || []);
    })();
    return () => { alive = false; };
  }, [active]);

  const mapHref = (s: RentalShop) =>
    s.lat != null && s.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((s.name + " " + s.region + s.town + s.address).trim())}`;

  const canLoadMore = rows.length < rpcTotal;

  return (
    <>
      <section className="disc">
        <div className="shell">
          <div className="places-tabs">
            {POI_KINDS.map((k) => <Link key={k.slug} href={`/places/${k.slug}`} className="chip">{TAB_LABEL[k.kind]}</Link>)}
            <span className="chip on">租車</span>
          </div>
          <div className="places-head">
            <h1 className="serif">租車</h1>
            <p>在地租車店與方案一次看——選好車、排進行程,到當地直接取車。</p>
          </div>

          <div className="disc-search">
            <div className="ds-field kw">
              <span className="ds-ic">{I.search}</span>
              <div><label>搜尋</label><input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="店名、地區或關鍵字" /></div>
            </div>
          </div>

          <div className="disc-filters">
            <div className="filter-row">
              <span className="filter-cap">{I.pin} 地區</span>
              <select className="region-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="縣市">
                <option value="all">全部地區</option>
                {GEOGRAPHIC_AREAS.map((a) => <optgroup key={a.name} label={a.name}>{a.regions.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="sec-head"><div className="st"><h2 className="serif">租車店</h2><span className="count">{rpcTotal} 家</span></div></div>

        <div className="cards">
          {rows.length === 0 && <div className="empty">這個地區還沒有收錄租車店,換個縣市看看。</div>}
          {rows.map((s) => (
            <button key={s.id} className="card" onClick={() => setActive(s)}>
              <div className="photo">
                {s.image ? <img src={s.image} alt={s.name} loading="lazy" /> : <div className="photo-ph">{I.car}</div>}
                {s.featured && <span className="tag-feat">精選</span>}
              </div>
              <div className="card-body">
                <div className="card-eyebrow">{s.region}{s.town ? " · " + s.town : ""}</div>
                <h3>{s.name}</h3>
                <div className="card-desc">{s.description || s.address}</div>
                <div className="card-bottom">
                  <strong>{s.price_from ? priceLabel(s.price_from) : "—"} <small>/ 日起</small></strong>
                  {s.units_left != null && s.units_left > 0 && <span className="capacity">{I.car} {s.units_left} 台可租</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {canLoadMore && (
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <button className="btn btn-ghost" onClick={() => load(kw, region, rows.length, true)} disabled={loading}>
              {loading ? "載入中…" : `載入更多(${rows.length}/${rpcTotal})`}
            </button>
          </div>
        )}
        <p className="sample-note">資訊由偶宿彙整,實際車況、保險與費用請以租車店為準。</p>
      </div>

      {active && (
        <>
          <div className="overlay" onClick={() => setActive(null)} />
          <div className="detail" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setActive(null)} aria-label="關閉">✕</button>
            {active.image ? <img className="detail-img" src={active.image} alt={active.name} /> : <div className="detail-img photo-ph">{I.car}</div>}
            <div className="detail-body">
              <div className="card-eyebrow">{active.region}{active.town ? " · " + active.town : ""}</div>
              <h2>{active.name}</h2>
              {active.address && <div className="detail-meta"><span>{I.pin} {active.address}</span>{active.phone && <span>{active.phone}</span>}</div>}
              {active.description && <p>{active.description}</p>}

              {plans.length > 0 && (
                <div className="room-list">
                  <h3 className="room-list-h">方案 / 車型</h3>
                  {plans.map((p) => (
                    <div className="room-row" key={p.id}>
                      <div className="room-main">
                        <div className="room-name">{p.name}</div>
                        {p.includes && <div className="room-desc">含:{p.includes}</div>}
                        <div className="room-tags">
                          {p.deposit != null && <span>押金 {priceLabel(p.deposit)}</span>}
                          {p.count_left != null && <span className={p.count_left <= 1 ? "room-left low" : "room-left"}>剩 {p.count_left} 台</span>}
                        </div>
                      </div>
                      <div className="room-price">{priceLabel(p.price_per_day)}<small>/日</small></div>
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-actions">
                <a className="btn btn-primary" href={mapHref(active)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 150 }}>{I.map} 取車地點</a>
                {active.website && <a className="btn btn-ghost" href={active.website} target="_blank" rel="noopener noreferrer">官網 {I.out}</a>}
                {active.line_url && <a className="btn btn-ghost" href={active.line_url} target="_blank" rel="noopener noreferrer">LINE 預約</a>}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
