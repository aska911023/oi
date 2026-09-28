"use client";

import { useMemo, useState } from "react";
import type { Stay, SortMode } from "@/lib/types";
import { CATEGORIES, ALL_CATEGORY_LABEL, GEOGRAPHIC_AREAS, PRICE_RANGES, priceLabel } from "@/lib/data";

const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  users: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="8" r="3.2" /><path d="M21 20v-1a4 4 0 0 0-3-3.8" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>,
  heart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21C6 16.5 3 13 3 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 9 3.2C21 13 18 16.5 12 21z" /></svg>,
};

export default function Explore({ stays }: { stays: Stay[] }) {
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
      {/* hero band */}
      <section className="hero-band">
        <div className="shell hero-inner">
          <div className="hero-copy">
            <div className="kicker">Taiwan · Stay a little longer</div>
            <h1>偶爾出走,<br />找到喜歡的一宿。</h1>
            <p>選個地方、挑種步調,出發就這麼簡單。從海邊到山裡,以地區、風格和預算,找到喜歡的台灣民宿。</p>
          </div>
          <div className="hero-figure">
            <img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1100&q=85" alt="靜謐的旅宿與窗景" />
            <span className="cap">找一間民宿,住進好風景</span>
          </div>
        </div>
      </section>

      <div className="shell">
        {/* search */}
        <div className="searchwrap">
          <div className="searchbar">
            <div className="search-kw">
              {I.search}
              <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="民宿名稱、地區或設備" />
            </div>
            <div className="search-field">
              <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="地區">
                <option value="all">全部地區</option>
                {regionsWithData.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="search-field">
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} aria-label="每晚預算">
                {PRICE_RANGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="search-field guests">
              <input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="入住人數" aria-label="入住人數" />
            </div>
            <button className="btn btn-primary search-go">{I.search} 找民宿</button>
          </div>
        </div>

        {/* filters */}
        <div className="filters">
          {regionsWithData.length > 0 && (
            <div className="filter-row">
              <span className="filter-cap">地區</span>
              <div className="chips">
                <button className={"chip " + (region === "all" ? "on" : "")} onClick={() => setRegion("all")}>全部</button>
                {regionsWithData.map((r) => (
                  <button key={r} className={"chip " + (region === r ? "on" : "")} onClick={() => setRegion(r)}>{r}</button>
                ))}
              </div>
            </div>
          )}
          <div className="filter-row">
            <span className="filter-cap">風格</span>
            <div className="chips">
              <button className={"chip " + (cat === ALL_CATEGORY_LABEL ? "on" : "")} onClick={() => setCat(ALL_CATEGORY_LABEL)}>{ALL_CATEGORY_LABEL}</button>
              {CATEGORIES.map((c) => (
                <button key={c} className={"chip " + (cat === c ? "on" : "")} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>

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
          {results.map((s, i) => (
            <button key={s.id} className="card reveal-card" style={{ animationDelay: `${(i % 9) * 45}ms` }} onClick={() => setActive(s)}>
              <div className="photo">
                <img src={s.image} alt={s.name} loading="lazy" />
                {s.featured && <span className="tag-feat">精選置頂</span>}
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
