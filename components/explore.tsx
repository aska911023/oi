"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RoomCard, SortMode } from "@/lib/types";
import { ALL_CATEGORY_LABEL, PRICE_RANGES, AMENITY_FILTERS, ROOM_TAGS, priceLabel, GEOGRAPHIC_AREAS } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import BlocksRender from "@/components/blocks-render";
import PhotoCarousel from "@/components/photo-carousel";
import SaveBookmark from "@/components/save-bookmark";
import CompareToggle from "@/components/compare-toggle";
import { DEFAULT_BLOCKS, type Block, type HeroLayout } from "@/lib/site-settings-types";

const PAGE = 24;

// 「設施」「房型」兩排細項篩選先關起來:目前上架資料的設施/房型標籤還填得不完整,
// 篩下去容易撈到空結果,反而讓人以為站上沒東西。等這兩個欄位填得夠齊再改回 true 即可
// (RPC 的 p_amenities / p_room_tags 參數與 toggle 邏輯都保留著,不用重做)。
const SHOW_DETAIL_FILTERS = false;

// 房型卡顯示「N 人收藏」的門檻。初期人氣還在累積,設 1 讓收藏馬上看得到;
// 之後量大了可以調回 3,避免「1 人收藏」反而像乏人問津。
const SAVE_COUNT_MIN = 1;

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>,
  users: <svg width="17" height="17" viewBox="0 0 24 24" {...S}><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="8" r="3.2" /><path d="M21 20v-1a4 4 0 0 0-3-3.8" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  grid: <svg width="15" height="15" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  arrow: <svg width="17" height="17" viewBox="0 0 24 24" {...S}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  // 尚未取得照片授權時的佔位
  house: <svg width="34" height="34" viewBox="0 0 24 24" {...S}><path d="M3 10.5 12 4l9 6.5" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg>,
};

// 相簿優先,無相簿退回單張 image;都沒有則回空陣列(顯示佔位)
const toImgs = (image?: string | null, images?: string[] | null) =>
  (images && images.length ? images : image ? [image] : []);


export default function Explore({ rooms, total = 0, regions = [], categories = [], blocks, searchHint, heroLayout, heroSplitRatio }: { rooms: RoomCard[]; total?: number; regions?: string[]; categories?: string[]; blocks?: Block[]; searchHint?: string; heroLayout?: HeroLayout; heroSplitRatio?: number }) {
  const [kw, setKw] = useState("");
  const [area, setArea] = useState("");            // 選中的大區(北/中/南/東/離島),"" = 全部地區
  const [regionSel, setRegionSel] = useState<string[]>([]); // 區內多選縣市
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
  // 自己剛按的收藏先在前端加減,數字立刻會動;重新查詢時 RPC 回來的值會蓋掉它
  const [saveDelta, setSaveDelta] = useState<Record<string, number>>({});
  const saveCountOf = (r: RoomCard) => (r.save_count ?? 0) + (saveDelta[r.id] ?? 0);
  const firstRun = useRef(true);

  // 只顯示「有民宿」的大區與縣市(資料驅動);選了大區沒點縣市 → 篩整個大區
  const areaList = GEOGRAPHIC_AREAS.map((a) => ({ name: a.name, counties: a.regions.filter((r) => regions.includes(r)) })).filter((a) => a.counties.length > 0);
  const curCounties = areaList.find((a) => a.name === area)?.counties || [];
  const effRegions = regionSel.length ? regionSel : (area ? curCounties : []);
  const toggleCounty = (c: string) => setRegionSel((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  function rpcArgs(off: number) {
    const pr = PRICE_RANGES.find((p) => p.value === priceRange)!;
    return {
      kw: kw.trim(), p_region: null, p_regions: effRegions.length ? effRegions : null,
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
  }, [kw, area, regionSel, guests, priceRange, cat, sort, amens, roomTags]);

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
                <button className={"chip " + (!area ? "on" : "")} onClick={() => { setArea(""); setRegionSel([]); }}>全部地區</button>
                {areaList.map((a) => (
                  <button key={a.name} className={"chip " + (area === a.name ? "on" : "")} onClick={() => { setArea(a.name); setRegionSel([]); }}>{a.name}</button>
                ))}
              </div>
            </div>
            {area && curCounties.length > 0 && (
              <div className="filter-row filter-subrow" style={{ alignItems: "flex-start" }}>
                <span className="filter-cap">{area}縣市</span>
                <div className="chips">
                  {curCounties.map((c) => (
                    <button key={c} className={"chip chip-sub " + (regionSel.includes(c) ? "on" : "")} onClick={() => toggleCounty(c)}>{c}</button>
                  ))}
                </div>
              </div>
            )}
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
          {SHOW_DETAIL_FILTERS && <div className="disc-filters">
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
          </div>}
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
              <Link href={`/${encodeURIComponent(r.region)}/hotel/${encodeURIComponent(r.stay_slug || r.stay_id)}`} className="card">
                <div className={"photo" + (toImgs(r.image, r.images).length ? "" : " noimg")}>
                  {toImgs(r.image, r.images).length
                    ? <PhotoCarousel images={toImgs(r.image, r.images)} alt={r.stay_name} width={640} />
                    : <div className="photo-ph">{I.house}</div>}
                  <div className="card-badges">
                    {r.kind === "whole" && <span className="cbadge cbadge-whole">包棟</span>}
                    {r.ad_tier && r.ad_tier !== "free" && <span className="cbadge cbadge-feat">精選</span>}
                  </div>
                  {r.rooms_total != null && <span className="tag-rooms">共 {r.rooms_total} 間</span>}
                </div>
                <div className="card-body">
                  <div className="card-eyebrow">{r.region} · {r.town}<span className="dot" />{r.category}</div>
                  <h3>{r.stay_name}</h3>
                  <div className="card-desc">{r.room_name}{r.beds ? ` · ${r.beds}` : ""}</div>
                  <div className="card-bottom">
                    <strong>{priceLabel(r.price)} <small>/ 晚起</small></strong>
                    {saveCountOf(r) >= SAVE_COUNT_MIN && <span className="card-saves">♥ {saveCountOf(r)} 人收藏</span>}
                  </div>
                </div>
              </Link>
              <SaveBookmark type="room" id={r.id} floating nextPath={`/stay/${r.stay_id}`}
                onToggle={(on) => setSaveDelta((d) => ({ ...d, [r.id]: (d[r.id] ?? 0) + (on ? 1 : -1) }))} />
              <CompareToggle card={r} />
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
