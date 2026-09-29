"use client";

import { useMemo, useState } from "react";
import type { Stay, SortMode } from "@/lib/types";
import { CATEGORIES, ALL_CATEGORY_LABEL, GEOGRAPHIC_AREAS, PRICE_RANGES, priceLabel } from "@/lib/data";
import BlocksRender from "@/components/blocks-render";
import { DEFAULT_BLOCKS, type Block, type HeroLayout } from "@/lib/site-settings-types";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  users: <svg width="17" height="17" viewBox="0 0 24 24" {...S}><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="8" r="3.2" /><path d="M21 20v-1a4 4 0 0 0-3-3.8" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  grid: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  arrow: <svg width="17" height="17" viewBox="0 0 24 24" {...S}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M7 17L17 7M9 7h8v8" /></svg>,
  heart: <svg width="16" height="16" viewBox="0 0 24 24" {...S}><path d="M12 21C6 16.5 3 13 3 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 9 3.2C21 13 18 16.5 12 21z" /></svg>,
};

const CAT_ICON: Record<string, React.ReactNode> = {
  全部: <svg viewBox="0 0 24 24" {...S}><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  海景度假: <svg viewBox="0 0 24 24" {...S}><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>,
  山林小屋: <svg viewBox="0 0 24 24" {...S}><path d="M3 20l6-11 4 6 2-3 6 8z" /></svg>,
  設計旅宿: <svg viewBox="0 0 24 24" {...S}><rect x="3" y="10" width="18" height="7" rx="2" /><path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M6 20v-3M18 20v-3" /></svg>,
  親子友善: <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="9" /><path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" /></svg>,
  寵物友善: <svg viewBox="0 0 24 24" {...S}><circle cx="5.5" cy="12" r="1.8" /><circle cx="9.5" cy="8" r="1.8" /><circle cx="14.5" cy="8" r="1.8" /><circle cx="18.5" cy="12" r="1.8" /><path d="M8.5 16.5a3.5 3.5 0 0 1 7 0 2.6 2.6 0 0 1-2.6 2.6h-1.8a2.6 2.6 0 0 1-2.6-2.6z" /></svg>,
  包棟民宿: <svg viewBox="0 0 24 24" {...S}><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-6h6v6" /></svg>,
};

export default function Explore({ stays, blocks, searchHint, heroLayout, heroSplitRatio }: { stays: Stay[]; blocks?: Block[]; searchHint?: string; heroLayout?: HeroLayout; heroSplitRatio?: number }) {
  const [kw, setKw] = useState("");
  const [region, setRegion] = useState("all");
  const [guests, setGuests] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [cat, setCat] = useState(ALL_CATEGORY_LABEL);
  const [sort, setSort] = useState<SortMode>("default");
  const [active, setActive] = useState<Stay | null>(null);

  const base = useMemo(() => stays.filter((s) => s.published), [stays]);

  const regionsWithData = useMemo(() => {
    const set = new Set(base.map((s) => s.region));
    return GEOGRAPHIC_AREAS.flatMap((a) => a.regions).filter((r) => set.has(r));
  }, [base]);

  const results = useMemo(() => {
    const pr = PRICE_RANGES.find((p) => p.value === priceRange)!;
    const g = guests.trim() ? parseInt(guests) : null;
    let r = base.filter((s) => {
      if (cat !== ALL_CATEGORY_LABEL && s.category !== cat) return false;
      if (region !== "all" && s.region !== region) return false;
      if (pr.min != null && s.price < pr.min) return false;
      if (pr.max != null && s.price > pr.max) return false;
      if (g && s.guests < g) return false;
      if (kw.trim()) {
        const hay = (s.name + s.region + s.town + s.amenities).toLowerCase();
        if (!hay.includes(kw.trim().toLowerCase())) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      if (sort === "low") return a.price - b.price;
      if (sort === "high") return b.price - a.price;
      return Number(b.featured ?? false) - Number(a.featured ?? false);
    });
    return r;
  }, [base, cat, region, priceRange, guests, kw, sort]);

  return (
    <>
      {/* discovery hero(白底綠字) */}
      <section className="disc">
        <div className="shell">
          <BlocksRender blocks={blocks && blocks.length ? blocks : DEFAULT_BLOCKS} layout={heroLayout} ratio={heroSplitRatio} />
        </div>

        <div className="shell">
          <div className="disc-search">
            <div className="ds-field kw">
              <span className="ds-icon">{I.search}</span>
              <div className="ds-body">
                <span className="ds-cap">想去哪裡住一晚?</span>
                <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋地點、民宿名稱或特色" />
              </div>
            </div>
            <div className="ds-field">
              <div className="ds-body">
                <span className="ds-cap">每晚起價</span>
                <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} aria-label="每晚起價">
                  {PRICE_RANGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="ds-field">
              <span className="ds-icon">{I.users}</span>
              <div className="ds-body">
                <span className="ds-cap">入住人數</span>
                <input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="不限" aria-label="入住人數" />
              </div>
            </div>
            <button className="btn btn-primary ds-go">找民宿 {I.arrow}</button>
          </div>
          <p className="search-hint">{searchHint || "依每晚起價與最多入住人數篩選;實際房價與空房請向民宿確認。"}</p>

          <div className="disc-filters">
            {regionsWithData.length > 0 && (
              <div className="filter-row">
                <span className="filter-cap">{I.pin} 目的地</span>
                <div className="chips">
                  <button className={"chip " + (region === "all" ? "on" : "")} onClick={() => setRegion("all")}>全部地區</button>
                  {regionsWithData.map((r) => (
                    <button key={r} className={"chip " + (region === r ? "on" : "")} onClick={() => setRegion(r)}>{r}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="filter-row">
              <span className="filter-cap">{I.grid} 住宿風格</span>
              <div className="chips">
                <button className={"chip style-chip " + (cat === ALL_CATEGORY_LABEL ? "on" : "")} onClick={() => setCat(ALL_CATEGORY_LABEL)}>{CAT_ICON["全部"]}{ALL_CATEGORY_LABEL}</button>
                {CATEGORIES.map((c) => (
                  <button key={c} className={"chip style-chip " + (cat === c ? "on" : "")} onClick={() => setCat(c)}>{CAT_ICON[c]}{c}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        {/* section head */}
        <div className="sec-head">
          <div className="st">
            <h2 className="serif">{cat === ALL_CATEGORY_LABEL ? "精選民宿" : cat}</h2>
            <span className="count">{results.length} 間</span>
          </div>
          <div className="sort">
            <span>排序</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="default">精選推薦</option>
              <option value="low">價格由低到高</option>
              <option value="high">價格由高到低</option>
            </select>
          </div>
        </div>

        {/* cards */}
        <div className="cards">
          {results.length === 0 && <div className="empty">找不到符合條件的民宿,換個關鍵字或風格試試。</div>}
          {results.map((s) => (
            <button key={s.id} className="card" onClick={() => setActive(s)}>
              <div className="photo">
                <img src={s.image} alt={s.name} loading="lazy" />
                {s.featured && <span className="tag-feat">精選置頂</span>}
                {s.rooms_left != null && <span className={"tag-rooms" + (s.rooms_left <= 2 ? " low" : "")}>剩 {s.rooms_left} 房</span>}
              </div>
              <div className="card-body">
                <div className="card-eyebrow">{s.region} · {s.town}<span className="dot" />{s.category}</div>
                <h3>{s.name}</h3>
                <div className="card-desc">{s.description}</div>
                <div className="card-bottom">
                  <strong>{priceLabel(s.price)} <small>/ 晚起</small></strong>
                  <span className="capacity">{I.users} {s.guests} 人</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="sample-note">標示「精選置頂」為贊助曝光;範例民宿與照片僅供體驗,實際房價與空房請向民宿確認。</p>
      </div>

      {/* detail modal */}
      {active && (
        <>
          <div className="overlay" onClick={() => setActive(null)} />
          <div className="detail" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setActive(null)} aria-label="關閉">✕</button>
            <img className="detail-img" src={active.image} alt={active.name} />
            <div className="detail-body">
              <div className="card-eyebrow">{active.region} · {active.town}<span className="dot" />{active.category}</div>
              <h2>{active.name}</h2>
              <div className="detail-meta">
                <span>{priceLabel(active.price)} / 晚起</span>
                <span>最多 {active.guests} 人</span>
                {active.rooms_left != null && <span>剩餘 {active.rooms_left} 房</span>}
              </div>
              <div className="m-amenities">
                {active.amenities.split("、").filter(Boolean).map((a) => <span key={a} className="am-chip">{a}</span>)}
              </div>
              <p>{active.description}</p>
              <div className="notice">依每晚起價與最多入住人數提供參考;實際房價、空房與訂房請向民宿確認。</div>
              <div className="detail-actions">
                <a
                  className="btn btn-primary"
                  href={active.website || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!active.website) e.preventDefault(); }}
                  style={{ flex: 1, minWidth: 190, opacity: active.website ? 1 : 0.55 }}
                >
                  {active.website ? "前往預訂 / 民宿官網" : "尚未提供官網"} {I.out}
                </a>
                <button className="btn btn-ghost">{I.heart} 收藏</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
