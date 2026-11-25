import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SaveButton from "@/components/save-button";
import ReviewForm from "@/components/review-form";
import PhotoCarousel from "@/components/photo-carousel";
import RoomList from "@/components/room-list";
import BookNow from "@/components/book-now";
import ChatStayButton from "@/components/chat-stay-button";
import AdCarousel from "@/components/ad-carousel";
import ClaimButton from "@/components/claim-button";
import RoomTile from "@/components/room-tile";
import { getRoomsByRegion } from "@/lib/rooms";
import BackLink from "@/components/back-link";
import TrackView from "@/components/track-view";
import OutboundLink from "@/components/outbound-link";
import ShareStayButton from "@/components/share-stay-button";
import MediaEmbed from "@/components/media-embed";
import PlacesMap from "@/components/places-map";
import AddToTrip from "@/components/add-to-trip";
import { breadcrumbLd } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import type { Stay, RoomType } from "@/lib/types";

const toImgs = (image?: string, images?: string[] | null) => (images && images.length ? images : image ? [image] : []);
const OUT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>;
const enc = encodeURIComponent;

// 民宿詳情(server 元件;城市優先網址 /{region}/hotel/{slug} 使用)
export default async function StayDetail({ stay: s }: { stay: Stay }) {
  const sb = await createClient();
  const { data: roomsData } = await sb.from("room_types").select("*").eq("stay_id", s.id).eq("published", true).order("sort").order("price");
  const rooms = (roomsData as RoomType[]) || [];
  // 線上訂房總開關(下週補完前先全站隱藏);各民宿仍需自己「啟用訂房」才顯示
  const bookingLive = (await getSiteSettings()).booking_live;
  // 其他民宿推薦(曝光版位):同縣市、付費/精選方案優先(search_rooms 已依 ad_prio 排序),去重排除本間。
  const { rooms: recoAll } = await getRoomsByRegion(s.region);
  const seen = new Set<string>([s.id]);
  const recos: typeof recoAll = [];
  for (const r of recoAll) { if (!seen.has(r.stay_id)) { seen.add(r.stay_id); recos.push(r); } if (recos.length >= 4) break; }
  const amenities = (s.amenities || "").split("、").map((a) => a.trim()).filter(Boolean);

  const { data: revData } = await sb.from("reviews").select("rating, comment, created_at, profiles(display_name)").eq("stay_id", s.id).order("created_at", { ascending: false });
  const reviews = (revData || []) as unknown as { rating: number; comment: string; created_at: string; profiles: { display_name: string } | null }[];
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  // 這間民宿的活動專欄(店家自己的活動 / 專案 / 加購;admin 或業主在後台上架)
  const { data: promoData } = await sb.from("stay_promos").select("*").eq("stay_id", s.id).eq("published", true).order("sort").order("created_at", { ascending: false });
  const promos = (promoData || []) as { id: string; title: string; subtitle: string | null; image: string | null; link_url: string | null; price_note: string | null; badge: string | null; start_date: string | null; end_date: string | null }[];

  // 附近推薦:用 nearby_pois RPC 依「與這間民宿的距離」排序(真的附近,不是同縣市取最舊 N 筆)
  type NB = { id: string; name: string; slug?: string };
  const { data: nbRaw } = await sb.rpc("nearby_pois", { p_region: s.region, p_lat: s.lat ?? null, p_lng: s.lng ?? null, p_exclude: s.id });
  const nb = (nbRaw || {}) as { attractions?: NB[]; restaurants?: NB[]; parking?: NB[]; rentals?: NB[]; happenings?: NB[] };
  const nearby: { label: string; more: string; items: { id: string; name: string; href: string }[] }[] = [
    { label: "附近活動", more: `/events`, items: (nb.happenings || []).map((x) => ({ id: x.id, name: x.name, href: `/events/${enc(x.slug || x.id)}` })) },
    { label: "附近景點", more: `/${enc(s.region)}/attractions`, items: (nb.attractions || []).map((x) => ({ id: x.id, name: x.name, href: `/${enc(s.region)}/attraction/${enc(x.slug || x.id)}` })) },
    { label: "附近美食", more: `/${enc(s.region)}/restaurants`, items: (nb.restaurants || []).map((x) => ({ id: x.id, name: x.name, href: `/${enc(s.region)}/restaurant/${enc(x.slug || x.id)}` })) },
    { label: "附近停車", more: `/${enc(s.region)}/parking`, items: (nb.parking || []).map((x) => ({ id: x.id, name: x.name, href: `/${enc(s.region)}/parking/${enc(x.slug || x.id)}` })) },
    { label: "附近租車", more: `/rentals`, items: (nb.rentals || []).map((x) => ({ id: x.id, name: x.name, href: `/rentals` })) },
  ].filter((g) => g.items.length > 0);

  const ldImgs = toImgs(s.image, s.images);
  const roomPrices = rooms.map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
  const minPrice = roomPrices.length ? Math.min(...roomPrices) : (Number(s.price) > 0 ? Number(s.price) : null);
  const sameAs = [s.website, s.line_url].filter((u): u is string => !!u && /^https?:\/\//.test(u));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: s.name,
    description: s.description || undefined,
    image: ldImgs.length ? ldImgs : undefined,
    url: `https://www.oi-stay.com/${enc(s.region)}/hotel/${enc(s.slug || s.id)}`,
    address: { "@type": "PostalAddress", addressCountry: "TW", addressRegion: s.region || undefined, addressLocality: s.town || undefined, streetAddress: s.address || undefined },
    geo: s.lat != null && s.lng != null ? { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } : undefined,
    priceRange: minPrice ? `NT$${minPrice.toLocaleString()} 起` : undefined,
    aggregateRating: reviews.length ? { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: reviews.length } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  const crumbLd = breadcrumbLd([
    { name: "偶宿 O!", path: "/" },
    { name: s.region, path: `/${enc(s.region)}` },
    { name: `${s.region}住宿`, path: `/${enc(s.region)}/hotels` },
    { name: s.name, path: `/${enc(s.region)}/hotel/${enc(s.slug || s.id)}` },
  ]);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <BackLink fallback={`/${enc(s.region)}/hotels`} label="← 返回" />

      <div className="shop">
        <TrackView stayId={s.id} />
        {toImgs(s.image, s.images).length > 0 && (
          <>
            <div className="shop-hero-c"><PhotoCarousel images={toImgs(s.image, s.images)} alt={s.name} /></div>
            <div className="hc-refnote">圖片僅供參考</div>
          </>
        )}
        <div className="card-eyebrow" style={{ marginTop: 18 }}><Link href={`/${enc(s.region)}`} className="lnk">{s.region}</Link> · {s.town}<span className="dot" />{s.category}</div>
        <h1 className="serif shop-title">{s.name}</h1>
        {s.description && <p className="shop-desc">{s.description}</p>}

        {s.address && <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>📍 {s.address}</div>}
        {(s.check_in || s.check_out) && (
          <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14, color: "var(--text-2)", marginTop: 6 }}>
            🕒 {s.check_in ? `入住 ${s.check_in} 後` : ""}{s.check_in && s.check_out ? " · " : ""}{s.check_out ? `退房 ${s.check_out} 前` : ""}
          </div>
        )}
        {s.license_no && <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>🏛 合法民宿登記證號:{s.license_no}</div>}

        <div className="detail-actions" style={{ margin: "16px 0 4px" }}>
          {bookingLive && s.booking_enabled && <BookNow stayId={s.id} stayName={s.name} rooms={rooms} bookingNote={s.booking_note} depositPct={s.booking_deposit_pct} />}
          {s.website && <OutboundLink type="click_website" stayId={s.id} href={s.website} utm className="btn btn-ghost">前往預訂 / 民宿官網 {OUT}</OutboundLink>}
          {s.line_url && <OutboundLink type="click_line" stayId={s.id} href={s.line_url.startsWith("http") ? s.line_url : `https://line.me/R/ti/p/${enc(s.line_url)}`} className="btn btn-ghost">官方 LINE {OUT}</OutboundLink>}
          {s.owner_id && <ChatStayButton stayId={s.id} stayName={s.name} />}
          {(s.address || (s.lat != null && s.lng != null)) && (
            <OutboundLink type="click_map" stayId={s.id} className="btn btn-ghost"
              href={s.lat != null && s.lng != null
                ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${enc((s.name + " " + s.region + s.town + (s.address || "")).trim())}`}>在地圖開啟 {OUT}</OutboundLink>
          )}
          <SaveButton stayId={s.id} />
          <AddToTrip type="stay" refId={s.id} name={s.name} region={s.region} />
          <ShareStayButton stayId={s.id} name={s.name} />
        </div>

        {!s.owner_id && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: "var(--muted)" }}>
            🪪 是「{s.name}」的業者嗎?<ClaimButton kind="stay" targetId={s.id} targetName={s.name} label="認領並管理這間" />
          </div>
        )}

        {promos.length > 0 && (
          <div className="shop-block">
            <h2 className="serif shop-h">活動專欄 <span className="count">{promos.length}</span></h2>
            <div style={{ display: "grid", gap: 12 }}>
              {promos.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 14, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "var(--surface-2)" }}>
                  {p.image && <img src={p.image} alt={p.title} style={{ width: 128, minWidth: 128, height: 128, objectFit: "cover" }} />}
                  <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {p.badge && <span className="pill feat" style={{ fontSize: 11 }}>{p.badge}</span>}
                      <b style={{ fontSize: 16 }}>{p.title}</b>
                    </div>
                    {p.subtitle && <p style={{ color: "var(--text-2)", fontSize: 14, margin: "6px 0 0", lineHeight: 1.6 }}>{p.subtitle}</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                      {p.price_note && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14.5 }}>{p.price_note}</span>}
                      {(p.start_date || p.end_date) && <span style={{ color: "var(--muted)", fontSize: 13 }}>🗓 {[p.start_date, p.end_date].filter(Boolean).join(" ~ ")}</span>}
                      {p.link_url && <a className="btn btn-ghost btn-sm" href={p.link_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto" }}>了解更多 {OUT}</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="shop-block">
          <h2 className="serif shop-h">房型 <span className="count">{rooms.length}</span></h2>
          {rooms.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 14 }}>這間目前尚未提供房型資訊。</p> : <RoomList rooms={rooms} stayId={s.id} stayName={s.name} bookingEnabled={bookingLive && !!s.booking_enabled} bookingNote={s.booking_note} depositPct={s.booking_deposit_pct} />}
        </div>

        {s.embed_urls && s.embed_urls.length > 0 && (
          <div className="shop-block">
            <h2 className="serif shop-h">影片介紹 / 網紅推薦</h2>
            <div className="embed-list">{s.embed_urls.map((u, i) => <div className="embed-cell" key={i}><MediaEmbed url={u} /></div>)}</div>
          </div>
        )}

        {amenities.length > 0 && (
          <div className="shop-block">
            <h2 className="serif shop-h">設施 / 服務</h2>
            <div className="m-amenities">{amenities.map((a) => <span key={a} className="am-chip">{a}</span>)}</div>
          </div>
        )}

        {(s.notice_booking || s.notice_checkout) && (
          <div className="shop-block">
            {s.notice_booking && <><h2 className="serif shop-h">訂房須知</h2><p className="shop-desc" style={{ marginBottom: s.notice_checkout ? 20 : 0 }}>{s.notice_booking}</p></>}
            {s.notice_checkout && <><h2 className="serif shop-h">退房須知</h2><p className="shop-desc">{s.notice_checkout}</p></>}
          </div>
        )}

        {s.lat != null && s.lng != null && (
          <div className="shop-block">
            <h2 className="serif shop-h">位置</h2>
            <PlacesMap points={[{ id: s.id, name: s.name, lat: Number(s.lat), lng: Number(s.lng), kind: "hotel" }]} height={300} />
          </div>
        )}

        {nearby.length > 0 && (
          <div className="shop-block">
            <h2 className="serif shop-h">附近推薦</h2>
            {nearby.map((g) => (
              <div className="nearby-group" key={g.label}>
                <div className="nearby-head"><span>{g.label}</span><Link className="lnk" href={g.more}>更多 →</Link></div>
                <div className="nearby-chips">{g.items.map((it) => <Link key={it.id} href={it.href} className="am-chip">{it.name}</Link>)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="shop-block">
          <h2 className="serif shop-h">附近充電 / 換電 / 加油</h2>
          <div className="detail-actions">
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${enc((s.region + s.town + " 電動車充電站").trim())}`}>⚡ 找附近充電站</a>
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${enc((s.region + s.town + " Gogoro 換電站").trim())}`}>🔋 找附近換電站(Gogoro)</a>
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${enc((s.region + s.town + " 加油站").trim())}`}>⛽ 找附近加油站</a>
          </div>
        </div>

        <div className="shop-block">
          <h2 className="serif shop-h">評價 {reviews.length > 0 && <span className="count">★ {avg.toFixed(1)} · {reviews.length} 則</span>}</h2>
          <ReviewForm stayId={s.id} />
          {reviews.length > 0 && (
            <div className="review-list">
              {reviews.map((r, i) => (
                <div className="review-row" key={i}>
                  <div className="review-top">
                    <span className="review-stars">{"★".repeat(r.rating)}<span className="review-off">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="review-name">{r.profiles?.display_name || "旅人"}</span>
                  </div>
                  {r.comment && <p className="review-comment">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="notice">房價與空房為參考;實際訂房、加購與活動請透過上方民宿官方管道確認。</div>
      </div>

      <AdCarousel region={s.region} />

      {recos.length > 0 && (
        <section className="shell" style={{ paddingTop: 6, paddingBottom: 54 }}>
          <h2 className="serif shop-h" style={{ marginBottom: 14 }}>{s.region}其他民宿推薦</h2>
          <div className="cards">{recos.map((r) => <RoomTile key={r.stay_id} r={r} />)}</div>
        </section>
      )}
    </main>
  );
}
