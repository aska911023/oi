"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RoomCard, SortMode } from "@/lib/types";
import { ALL_CATEGORY_LABEL, PRICE_RANGES, AMENITY_FILTERS, ROOM_TAGS, priceLabel } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import BlocksRender from "@/components/blocks-render";
import PhotoCarousel from "@/components/photo-carousel";
import SaveBookmark from "@/components/save-bookmark";
import { DEFAULT_BLOCKS, type Block, type HeroLayout } from "@/lib/site-settings-types";

const PAGE = 24;

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  users: <svg width="17" height="17" viewBox="0 0 24 24" {...S}><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="8" r="3.2" /><path d="M21 20v-1a4 4 0 0 0-3-3.8" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  grid: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  arrow: <svg width="17" height="17" viewBox="0 0 24 24" {...S}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};


export default function Explore({ rooms, total = 0, regions = [], categories = [], blocks, searchHint, heroLayout, heroSplitRatio }: { rooms: RoomCard[]; total?: number; regions?: string[]; categories?: string[]; blocks?: Block[]; searchHint?: string; heroLayout?: HeroLayout; heroSplitRatio?: number }) {
  const [kw, setKw] = useState("");
  const [region, setRegion] = useState("all");
  const [guests, setGuests] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [cat, setCat] = useState(ALL_CATEGORY_LABEL);
  const [amens, setAmens] = useState<string[]>([]);
  const [roomTags, setRoomTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>("default");
  const toggleAmen = (a: string) => setAmens((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const toggleRoomTag = (a: string) => setRoomTags((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));

  const [rows, setRows] = useState<RoomCard[]>(rooms);
  const [rpcTotal, setRpcTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  function rpcArgs(off: number) {
    const pr = PRICE_RANGES.find((p) => p.value === priceRange)!;
    return {
      kw: kw.trim(), p_region: region === "all" ? null : region,
      p_price_min: pr.min ? pr.min : null, p_price_max: pr.max ?? null,
      p_guests: guests.trim() ? parseInt(guests) : null,
      p_category: cat === ALL_CATEGORY_LABEL ? null : cat,
      p_amenities: amens.length ? amens : null,
      p_room_tags: roomTags.length ? roomTags : null,
      p_sort: sort, lim: PAGE, off,
    };
  }
  async function fetchPage(off: number, append: boolean) {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.rpc("search_rooms", rpcArgs(off));
    const newRows = (data?.rows || []) as RoomCard[];
    setRpcTotal(data?.total ?? 0);
    setRows((prev) => (append ? [...prev, ...newRows] : newRows));
    setLoading(false);
  }
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => fetchPage(0, false), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, region, guests, priceRange, cat, sort, amens, roomTags]);

  const canLoadMore = rows.length < rpcTotal;

  return (
    <>
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
                <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋地點、民宿名稱或房型" />
              </div>
            </div>
            <div className="ds-field">
              <div className="ds-body">
                <span className="ds-cap">每晚房價</span>
                <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} aria-label="每晚房價">
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
            <button className="btn btn-primary ds-go">找房型 {I.arrow}</button>
          </div>
          <p className="search-hint">{searchHint || "顯示各房型每晚房價與可住人數;實際房價與空房請向民宿確認。"}</p>

          <div className="disc-filters">
            <div className="filter-row" style={{ alignItems: "flex-start" }}>
              <span className="filter-cap">{I.pin} 目的地</span>
              <div className="chips">
                <button className={"chip " + (region === "all" ? "on" : "")} onClick={() => setRegion("all")}>全部地區</button>
                {regions.map((r) => (
                  <button key={r} className={"chip " + (region === r ? "on" : "")} onClick={() => setRegion(r)}>{r}</button>
                ))}
              </div>
            </div>
            {categories.length > 0 && (
              <div className="filter-row" style={{ alignItems: "flex-start" }}>
                <span className="filter-cap">{I.grid} 住宿風格</span>
                <div className="chips">
                  <button className={"chip " + (cat === ALL_CATEGORY_LABEL ? "on" : "")} onClick={() => setCat(ALL_CATEGORY_LABEL)}>{ALL_CATEGORY_LABEL}</button>
                  {categories.map((c) => (
                    <button key={c} className={"chip " + (cat === c ? "on" : "")} onClick={() => setCat(c)}>{c}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="disc-filters">
            <div className="filter-row" style={{ alignItems: "flex-start" }}>
              <span className="filter-cap">設施</span>
              <div className="chips">
                {AMENITY_FILTERS.map((a) => (
                  <button key={a} className={"chip " + (amens.includes(a) ? "on" : "")} onClick={() => toggleAmen(a)}>{a}</button>
                ))}
              </div>
            </div>
            <div className="filter-row" style={{ alignItems: "flex-start" }}>
              <span className="filter-cap">房型</span>
              <div className="chips">
                {ROOM_TAGS.map((a) => (
                  <button key={a} className={"chip " + (roomTags.includes(a) ? "on" : "")} onClick={() => toggleRoomTag(a)}>{a}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="sec-head">
          <div className="st">
            <h2 className="serif">{cat === ALL_CATEGORY_LABEL ? "精選房型" : cat}</h2>
            <span className="count">{rpcTotal} 間房型</span>
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

        <div className="cards">
          {rows.length === 0 && <div className="empty">找不到符合條件的房型,換個關鍵字或風格試試。</div>}
          {rows.map((r) => (
            <div className="card-wrap" key={r.id}>
              <Link href={`/stay/${r.stay_id}`} className="card">
                <div className="photo">
                  <PhotoCarousel images={r.images && r.images.length ? r.images : [r.image]} alt={r.stay_name} />
                  {r.featured && <span className="tag-feat">精選置頂</span>}
                  {r.rooms_total != null && <span className="tag-rooms">共 {r.rooms_total} 間</span>}
                </div>
                <div className="card-body">
                  <div className="card-eyebrow">{r.region} · {r.town}<span className="dot" />{r.category}</div>
                  <h3>{r.stay_name}</h3>
                  <div className="card-desc">{r.room_name}{r.beds ? ` · ${r.beds}` : ""}</div>
                  <div className="card-bottom">
                    <strong>{priceLabel(r.price)} <small>/ 晚起</small></strong>
                    <span className="capacity">{I.users} {r.capacity} 人</span>
                  </div>
                </div>
              </Link>
              <SaveBookmark type="room" id={r.id} floating nextPath={`/stay/${r.stay_id}`} />
            </div>
          ))}
        </div>

        {canLoadMore && (
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <button className="btn btn-ghost" onClick={() => fetchPage(rows.length, true)} disabled={loading}>
              {loading ? "載入中…" : `載入更多(${rows.length}/${rpcTotal})`}
            </button>
          </div>
        )}

        <p className="sample-note">標示「精選置頂」為贊助曝光;點房型可看該民宿(店家)的完整資訊與所有房型。實際房價與空房請向民宿確認。</p>
      </div>
    </>
  );
}
