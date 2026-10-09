import Link from "next/link";
import PhotoCarousel from "@/components/photo-carousel";
import SaveBookmark from "@/components/save-bookmark";
import SharePlaceButton from "@/components/share-place-button";
import PlaceComments from "@/components/place-comments";
import { DETAILS, type WeekHour } from "@/lib/places-config";
import { KIND_SINGULAR } from "@/lib/city";
import type { Place, PoiKind } from "@/lib/types";

const enc = encodeURIComponent;
const toImgs = (image?: string, images?: string[]) => (images && images.length ? images : image ? [image] : []);

const KIND_META: Record<PoiKind, { label: string; seg: string; cta: string; schemaType: string }> = {
  attraction: { label: "景點", seg: "attractions", cta: "官方網站", schemaType: "TouristAttraction" },
  food: { label: "美食", seg: "restaurants", cta: "官方網站 / 訂位", schemaType: "Restaurant" },
  parking: { label: "停車", seg: "parking", cta: "官方資訊", schemaType: "ParkingFacility" },
};

const MAP = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>;
const OUT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>;

// 景點 / 美食 / 停車:伺服器端詳情頁(可被索引)+ per-type JSON-LD。
export default function PlaceDetail({ place: p, kind }: { place: Place; kind: PoiKind }) {
  const meta = KIND_META[kind];
  const imgs = toImgs(p.image, p.images);
  const detail = (p.details || {}) as Record<string, unknown>;
  const dText = (k: string) => (typeof detail[k] === "string" ? (detail[k] as string) : "");
  const dList = (k: string) => (Array.isArray(detail[k]) ? (detail[k] as Record<string, string>[]) : []);
  const dWeek = (k: string) => (Array.isArray(detail[k]) ? (detail[k] as WeekHour[]).filter((e) => e && e.day) : []);
  const dTags = (k: string) => (Array.isArray(detail[k]) ? (detail[k] as string[]).filter((x) => typeof x === "string") : []);

  const mapHref = p.lat != null && p.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${enc((p.name + " " + p.region + p.town + p.address).trim())}`;

  const tagFields = DETAILS[kind].filter((f) => f.type === "tags" && dTags(f.key).length > 0);
  const scalars = DETAILS[kind].filter((f) => f.type === "text" && dText(f.key));
  const pdfs = DETAILS[kind].filter((f) => f.type === "pdf" && dText(f.key));
  const lists = DETAILS[kind].filter((f) => f.type === "list" && dList(f.key).length > 0);
  const weeks = DETAILS[kind].filter((f) => f.type === "weekhours" && dWeek(f.key).some((e) => e.closed || e.open || e.close));

  // per-type JSON-LD(只放真實有的欄位,不虛構評價/價格)
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": meta.schemaType,
    name: p.name,
    description: p.description || undefined,
    image: imgs.length ? imgs : undefined,
    url: `https://www.oi-stay.com/${enc(p.region)}/${KIND_SINGULAR[kind]}/${enc(p.slug || p.id)}`,
    address: { "@type": "PostalAddress", addressCountry: "TW", addressRegion: p.region || undefined, addressLocality: p.town || undefined, streetAddress: p.address || undefined },
    geo: p.lat != null && p.lng != null ? { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } : undefined,
    sameAs: p.website && /^https?:\/\//.test(p.website) ? [p.website] : undefined,
  };
  if (kind === "food") {
    const cuisines = dTags("tags");
    if (cuisines.length) jsonLd.servesCuisine = cuisines;
    if (dText("price_level")) jsonLd.priceRange = dText("price_level");
  }

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · <Link href={`/${enc(p.region)}`} className="lnk">{p.region}</Link> · <Link href={`/${enc(p.region)}/${meta.seg}`} className="lnk">{p.region}{meta.label}</Link>
      </nav>

      <div className="shop">
        {imgs.length > 0 && <div className="shop-hero-c" style={{ position: "relative" }}><PhotoCarousel images={imgs} alt={p.name} /><SaveBookmark type={kind} id={p.id} floating nextPath={`/${enc(p.region)}/${KIND_SINGULAR[kind]}/${enc(p.slug || p.id)}`} /></div>}
        <div className="card-eyebrow" style={{ marginTop: 18 }}>{p.region}{p.town ? " · " + p.town : ""}<span className="dot" />{meta.label}</div>
        <h1 className="serif shop-title">{p.name}</h1>
        {p.description && <p className="shop-desc">{p.description}</p>}
        {p.address && <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>📍 {p.address}</div>}

        <div className="detail-actions" style={{ margin: "16px 0 4px" }}>
          <a className="btn btn-primary" href={mapHref} target="_blank" rel="noopener noreferrer">{MAP} 在地圖開啟 / 導航</a>
          {p.website && <a className="btn btn-ghost" href={p.website} target="_blank" rel="noopener noreferrer">{meta.cta} {OUT}</a>}
          <SharePlaceButton name={p.name} mapUrl={mapHref} />
          {!imgs.length && <SaveBookmark type={kind} id={p.id} nextPath={`/${enc(p.region)}/${KIND_SINGULAR[kind]}/${enc(p.slug || p.id)}`} />}
        </div>

        {(tagFields.length > 0 || scalars.length > 0 || pdfs.length > 0 || lists.length > 0 || weeks.length > 0) && (
          <div className="shop-block">
            <h2 className="serif shop-h">{meta.label}資訊</h2>
            <div className="place-details">
              {tagFields.map((f) => (
                <div className="m-amenities" key={f.key} style={{ marginBottom: 10 }}>
                  {f.key !== "tags" && <span className="pd-tag-cap">{f.label.replace(/[（(].*$/, "")}</span>}
                  {dTags(f.key).map((t) => <span key={t} className="am-chip">{t}</span>)}
                </div>
              ))}
              {scalars.length > 0 && <dl className="pd-scalars">{scalars.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{dText(f.key)}</dd></div>)}</dl>}
              {weeks.map((f) => (
                <div className="pd-week" key={f.key}>
                  <h3 className="room-list-h">{f.label.replace(/[（(].*$/, "")}</h3>
                  {dWeek(f.key).map((e) => (
                    <div className="pd-week-row" key={e.day}>
                      <span className="pd-week-day">{e.day}</span>
                      <span className={"pd-week-time" + (e.closed ? " off" : "")}>{e.closed ? "休息" : (e.open && e.close ? `${e.open}–${e.close}` : "—")}</span>
                    </div>
                  ))}
                </div>
              ))}
              {pdfs.map((f) => <a key={f.key} className="btn btn-ghost" style={{ marginTop: 4 }} href={dText(f.key)} target="_blank" rel="noopener noreferrer">{f.label} {OUT}</a>)}
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
          </div>
        )}

        {dText("attribution") && (
          <p className="data-src">資料來源:{dText("attribution")}{dText("data_updated") && `,更新於 ${dText("data_updated")}`}。實際營業狀況請以店家公告為準。</p>
        )}

        <div className="shop-block" style={{ marginTop: 22 }}>
          <PlaceComments kind={kind} placeId={p.id} />
        </div>
      </div>
    </main>
  );
}
