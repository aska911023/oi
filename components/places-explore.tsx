"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Poi, PoiKind } from "@/lib/types";
import { POI_KINDS } from "@/lib/types";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

const PAGE = 24;

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M7 17L17 7M9 7h8v8" /></svg>,
  map: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>,
};

const KIND_COPY: Record<PoiKind, { title: string; sub: string; empty: string; cta: string }> = {
  attraction: { title: "探索景點", sub: "順著民宿的距離,把附近的好去處一起收進行程。", empty: "這個地區還沒有收錄景點,換個縣市看看。", cta: "查看介紹" },
  food: { title: "探索美食", sub: "在地小吃、風格餐廳、咖啡廳——先看看吃什麼。", empty: "這個地區還沒有收錄美食,換個縣市看看。", cta: "查看介紹" },
  parking: { title: "停車區域", sub: "出發前先確認停車點,少走冤枉路。", empty: "這個地區還沒有收錄停車點,換個縣市看看。", cta: "查看資訊" },
};

export default function PlacesExplore({ pois, total = 0, regions, kind }: { pois: Poi[]; total?: number; regions?: string[]; kind: PoiKind }) {
  const [kw, setKw] = useState("");
  const [region, setRegion] = useState("all");
  const [active, setActive] = useState<Poi | null>(null);
  const copy = KIND_COPY[kind];

  const [rows, setRows] = useState<Poi[]>(pois);
  const [rpcTotal, setRpcTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  // 切換分類時重置(景點↔美食↔停車是不同路由,通常會重掛,但保險)
  useEffect(() => { setRows(pois); setRpcTotal(total); firstRun.current = true; }, [pois, total]);

  const regionsWithData = useMemo(() => {
    const src = regions && regions.length ? regions : Array.from(new Set(rows.map((p) => p.region)));
    return GEOGRAPHIC_AREAS.flatMap((a) => a.regions).filter((r) => src.includes(r));
  }, [regions, rows]);

  async function fetchPage(off: number, append: boolean) {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.rpc("search_pois", { p_kind: kind, kw: kw.trim(), p_region: region === "all" ? null : region, lim: PAGE, off });
    const newRows = (data?.rows || []) as Poi[];
    setRpcTotal(data?.total ?? 0);
    setRows((prev) => (append ? [...prev, ...newRows] : newRows));
    setLoading(false);
  }

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { fetchPage(0, false); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, region]);

  const results = rows;
  const canLoadMore = rows.length < rpcTotal;

  const mapHref = (p: Poi) =>
    p.lat != null && p.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name + " " + p.region + p.town + p.address).trim())}`;

  return (
    <>
      <section className="disc">
        <div className="shell">
          {/* 二級分類切換 */}
          <div className="places-tabs">
            <Link href="/" className="chip">全部民宿</Link>
            {POI_KINDS.map((k) => (
              <Link key={k.slug} href={`/places/${k.slug}`} className={"chip" + (k.kind === kind ? " on" : "")}>{k.label}</Link>
            ))}
          </div>

          <div className="places-head">
            <h1 className="serif">{copy.title}</h1>
            <p>{copy.sub}</p>
          </div>

          {/* 搜尋 + 地區 */}
          <div className="disc-search">
            <div className="ds-field kw">
              <span className="ds-ic">{I.search}</span>
              <div>
                <label>搜尋</label>
                <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="名稱、地區或關鍵字" />
              </div>
            </div>
          </div>

          {regionsWithData.length > 0 && (
            <div className="disc-filters">
              <div className="filter-row">
                <span className="filter-cap">{I.pin} 地區</span>
                <div className="chips">
                  <button className={"chip " + (region === "all" ? "on" : "")} onClick={() => setRegion("all")}>全部</button>
                  {regionsWithData.map((r) => (
                    <button key={r} className={"chip " + (region === r ? "on" : "")} onClick={() => setRegion(r)}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="shell">
        <div className="sec-head">
          <div className="st"><h2 className="serif">{copy.title}</h2><span className="count">{rpcTotal} 筆</span></div>
        </div>

        <div className="cards">
          {results.length === 0 && <div className="empty">{copy.empty}</div>}
          {results.map((p) => (
            <button key={p.id} className="card" onClick={() => setActive(p)}>
              <div className="photo">
                {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <div className="photo-ph">{I.map}</div>}
                {p.featured && <span className="tag-feat">精選</span>}
              </div>
              <div className="card-body">
                <div className="card-eyebrow">{p.region}{p.town ? " · " + p.town : ""}</div>
                <h3>{p.name}</h3>
                <div className="card-desc">{p.description || p.address}</div>
              </div>
            </button>
          ))}
        </div>

        {canLoadMore && (
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <button className="btn btn-ghost" onClick={() => fetchPage(rows.length, true)} disabled={loading}>
              {loading ? "載入中…" : `載入更多(${rows.length}/${rpcTotal})`}
            </button>
          </div>
        )}
        <p className="sample-note">資訊由偶宿彙整,實際營業時間、費用與空位請以現場或官方公告為準。</p>
      </div>

      {active && (
        <>
          <div className="overlay" onClick={() => setActive(null)} />
          <div className="detail" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setActive(null)} aria-label="關閉">✕</button>
            {active.image ? <img className="detail-img" src={active.image} alt={active.name} /> : <div className="detail-img photo-ph">{I.map}</div>}
            <div className="detail-body">
              <div className="card-eyebrow">{active.region}{active.town ? " · " + active.town : ""}</div>
              <h2>{active.name}</h2>
              {active.address && <div className="detail-meta"><span>{I.pin} {active.address}</span></div>}
              {active.description && <p>{active.description}</p>}
              <div className="detail-actions">
                <a className="btn btn-primary" href={mapHref(active)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 160 }}>
                  {I.map} 在地圖開啟
                </a>
                {active.website && (
                  <a className="btn btn-ghost" href={active.website} target="_blank" rel="noopener noreferrer">
                    {copy.cta} {I.out}
                  </a>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
