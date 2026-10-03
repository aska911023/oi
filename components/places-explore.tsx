"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Place, PoiKind } from "@/lib/types";
import { POI_KINDS } from "@/lib/types";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { KIND_TABLE, DETAILS, safeKw } from "@/lib/places-config";
import ImageZoom from "@/components/image-zoom";

const PAGE = 24;

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M7 17L17 7M9 7h8v8" /></svg>,
  map: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>,
};

const TAB_LABEL: Record<PoiKind, string> = { attraction: "景點", food: "美食", parking: "停車" };

const KIND_COPY: Record<PoiKind, { title: string; sub: string; empty: string; cta: string }> = {
  attraction: { title: "探索景點", sub: "順著民宿的距離,把附近的好去處一起收進行程。", empty: "這個地區還沒有收錄景點,換個縣市看看。", cta: "查看介紹" },
  food: { title: "探索美食", sub: "在地小吃、風格餐廳、咖啡廳——先看看吃什麼。", empty: "這個地區還沒有收錄美食,換個縣市看看。", cta: "查看介紹" },
  parking: { title: "停車區域", sub: "出發前先確認停車點,少走冤枉路。", empty: "這個地區還沒有收錄停車點,換個縣市看看。", cta: "查看資訊" },
};

export default function PlacesExplore({ places, total = 0, kind }: { places: Place[]; total?: number; kind: PoiKind }) {
  const [kw, setKw] = useState("");
  const [region, setRegion] = useState("all");
  const [tags, setTags] = useState<string[]>([]);
  const [active, setActive] = useState<Place | null>(null);
  const [kindState, setKindState] = useState<PoiKind>(kind);
  const copy = KIND_COPY[kindState];

  const tagOptions = ((DETAILS[kindState].find((f) => f.type === "tags") as { options?: string[] } | undefined)?.options) || [];

  const [rows, setRows] = useState<Place[]>(places);
  const [rpcTotal, setRpcTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  // 直接進入某個路由(SSR)時,以 props 重置
  useEffect(() => { setKindState(kind); setRows(places); setRpcTotal(total); setKw(""); setRegion("all"); setTags([]); firstRun.current = true; }, [places, total, kind]);


  async function load(k: PoiKind, kwv: string, regionv: string, tagsv: string[], off: number, append: boolean) {
    setLoading(true);
    const sb = createClient();
    let query = sb.from(KIND_TABLE[k]).select("*", { count: "exact" }).eq("published", true);
    if (regionv !== "all") query = query.eq("region", regionv);
    if (tagsv.length) query = query.contains("details", { tags: tagsv }); // details.tags 需包含所選全部
    const kwv2 = safeKw(kwv);
    if (kwv2) query = query.or(`name.ilike.%${kwv2}%,region.ilike.%${kwv2}%,town.ilike.%${kwv2}%,address.ilike.%${kwv2}%`);
    const { data, count } = await query.order("featured", { ascending: false }).order("created_at", { ascending: false }).range(off, off + PAGE - 1);
    const newRows = (data || []) as Place[];
    setRpcTotal(count ?? 0);
    setRows((prev) => (append ? [...prev, ...newRows] : newRows));
    setLoading(false);
  }

  // 前端即時切換分類(不重載整頁,只打 RPC + 同步網址)
  function switchKind(k: PoiKind) {
    if (k === kindState) return;
    setKindState(k);
    setKw(""); setRegion("all"); setTags([]);
    firstRun.current = true; // 避免下方 debounce 再打一次
    const slug = POI_KINDS.find((x) => x.kind === k)?.slug || k;
    window.history.replaceState(null, "", `/places/${slug}`);
    load(k, "", "all", [], 0, false);
  }

  const toggleTag = (t: string) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { load(kindState, kw, region, tags, 0, false); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, region, tags]);

  const results = rows;
  const canLoadMore = rows.length < rpcTotal;

  const mapHref = (p: Place) =>
    p.lat != null && p.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name + " " + p.region + p.town + p.address).trim())}`;

  // details 渲染輔助
  const detail = active ? (active.details || {}) as Record<string, unknown> : {};
  const dText = (k: string) => (typeof detail[k] === "string" ? (detail[k] as string) : "");
  const dList = (k: string) => (Array.isArray(detail[k]) ? (detail[k] as Record<string, string>[]) : []);
  const dTags = (k: string) => (Array.isArray(detail[k]) ? (detail[k] as string[]).filter((x) => typeof x === "string") : []);

  return (
    <>
      <section className="disc">
        <div className="shell">
          {/* 二級分類切換 */}
          <div className="places-tabs">
            {POI_KINDS.map((k) => (
              <button key={k.slug} type="button" onClick={() => switchKind(k.kind)} className={"chip" + (k.kind === kindState ? " on" : "")}>{TAB_LABEL[k.kind]}</button>
            ))}
            <Link href="/rentals" className="chip">租車</Link>
            <Link href="/stations" className="chip">車站</Link>
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

          <div className="disc-filters">
            <div className="filter-row">
              <span className="filter-cap">{I.pin} 地區</span>
              <select className="region-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="縣市">
                <option value="all">全部地區</option>
                {GEOGRAPHIC_AREAS.map((a) => <optgroup key={a.name} label={a.name}>{a.regions.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>)}
              </select>
            </div>
          </div>
          {tagOptions.length > 0 && (
            <div className="disc-filters">
              <div className="filter-row" style={{ alignItems: "flex-start" }}>
                <span className="filter-cap">類型</span>
                <div className="chips">
                  {tagOptions.map((t) => (
                    <button key={t} className={"chip " + (tags.includes(t) ? "on" : "")} onClick={() => toggleTag(t)}>{t}</button>
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
            <button className="btn btn-ghost" onClick={() => load(kindState, kw, region, tags, rows.length, true)} disabled={loading}>
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
            {active.image ? <ImageZoom src={active.image} alt={active.name} imgClassName="detail-img" /> : <div className="detail-img photo-ph">{I.map}</div>}
            <div className="detail-body">
              <div className="card-eyebrow">{active.region}{active.town ? " · " + active.town : ""}</div>
              <h2>{active.name}</h2>
              {active.address && <div className="detail-meta"><span>{I.pin} {active.address}</span></div>}
              {active.description && <p>{active.description}</p>}

              {/* 分類專屬資訊 */}
              {(() => {
                const tagFields = DETAILS[kindState].filter((f) => f.type === "tags" && dTags(f.key).length > 0);
                const scalars = DETAILS[kindState].filter((f) => f.type === "text" && dText(f.key));
                const pdfs = DETAILS[kindState].filter((f) => f.type === "pdf" && dText(f.key));
                const lists = DETAILS[kindState].filter((f) => f.type === "list" && dList(f.key).length > 0);
                if (!tagFields.length && !scalars.length && !pdfs.length && !lists.length) return null;
                return (
                  <div className="place-details">
                    {tagFields.map((f) => (
                      <div className="m-amenities" key={f.key} style={{ marginBottom: 10 }}>
                        {f.key !== "tags" && <span className="pd-tag-cap">{f.label.replace(/[((].*$/, "")}</span>}
                        {dTags(f.key).map((t) => <span key={t} className="am-chip">{t}</span>)}
                      </div>
                    ))}
                    {scalars.length > 0 && (
                      <dl className="pd-scalars">
                        {scalars.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{dText(f.key)}</dd></div>)}
                      </dl>
                    )}
                    {pdfs.map((f) => (
                      <a key={f.key} className="btn btn-ghost" style={{ marginTop: 4 }} href={dText(f.key)} target="_blank" rel="noopener noreferrer">{f.label} {I.out}</a>
                    ))}
                    {lists.map((f) => f.type === "list" && (
                      <div className="pd-list" key={f.key}>
                        <h3 className="room-list-h">{f.label}</h3>
                        {dList(f.key).map((it, i) => (
                          <div className="pd-list-row" key={i}>
                            <span className="pd-li-main">{it[f.cols[0].key]}</span>
                            {f.cols[1] && it[f.cols[1].key] && <span className="pd-li-sub">{it[f.cols[1].key]}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}

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
