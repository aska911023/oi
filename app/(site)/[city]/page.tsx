import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion } from "@/lib/rooms";
import { isCity, CITIES, SECTIONS, getCityPlaces, getCityAllPoints } from "@/lib/city";
import { breadcrumbLd } from "@/lib/seo";
import { decodeParam } from "@/lib/slug";
import RoomTile from "@/components/room-tile";
import PlacesMap from "@/components/places-map";
import type { Place } from "@/lib/types";

export const dynamic = "force-dynamic";

const enc = encodeURIComponent;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = decodeParam((await params).city);
  if (!isCity(city)) return { title: "找不到城市" };
  const title = `${city}旅遊｜住宿・景點・美食・停車・行程`;
  const description = `${city}旅遊一站整理:精選${city}民宿住宿、必去景點、在地美食、停車資訊與推薦行程。偶宿 O! 帶你從「想去哪裡」到「怎麼玩」。`;
  const canonical = `/${enc(city)}`;
  return { title, description, alternates: { canonical }, openGraph: { title: `${title}｜偶宿 O!`, description, url: canonical, type: "website" } };
}

// 景點/美食預覽卡(連到 entity 詳情頁)
function placeCards(city: string, singular: string, items: Place[]) {
  return (
    <div className="cards">
      {items.map((p) => {
        const img = (p.images && p.images[0]) || p.image || "";
        return (
          <div className="card-wrap" key={p.id}>
            <Link href={`/${enc(city)}/${singular}/${enc(p.slug || p.id)}`} className="card">
              <div className={"photo" + (img ? "" : " noimg")}>
                {img
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={`${p.name} — ${p.region}${p.town}`} loading="lazy" />
                  : <div className="photo-ph" />}
              </div>
              <div className="card-body">
                <div className="card-eyebrow">{p.region}{p.town ? " · " + p.town : ""}</div>
                <h3>{p.name}</h3>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export default async function CityHub({ params }: { params: Promise<{ city: string }> }) {
  const city = decodeParam((await params).city);
  if (!isCity(city)) notFound();
  const [{ rooms, total }, attr, food, allPoints] = await Promise.all([
    getRoomsByRegion(city),
    getCityPlaces("attraction", city, 8),
    getCityPlaces("food", city, 8),
    getCityAllPoints(city),
  ]);
  const others = CITIES.filter((c) => c !== city);
  const crumbLd = breadcrumbLd([{ name: "偶宿 O!", path: "/" }, { name: city, path: `/${enc(city)}` }]);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · {city}
      </nav>
      <h1 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>{city}旅遊</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 24 }}>
        {city}的<b>住宿</b>、<b>景點</b>、<b>美食</b>、<b>停車</b>與<b>行程</b>,偶宿 O! 一次幫你整理好 —— 從「想去哪裡」到「怎麼玩」。
      </p>

      <div className="region-links" style={{ marginBottom: 24 }}>
        {SECTIONS.map((s) => (
          <Link key={s.seg} href={`/${enc(city)}/${s.seg}`} className="region-link">{city}{s.label}</Link>
        ))}
      </div>

      {allPoints.length > 0 && (
        <section className="map-sec">
          <PlacesMap points={allPoints} height={420} />
          <div className="map-legend">
            <span><i style={{ background: "#e8590c" }} />住宿</span>
            <span><i style={{ background: "#2f9e44" }} />景點</span>
            <span><i style={{ background: "#e03131" }} />美食</span>
            <span><i style={{ background: "#1971c2" }} />停車</span>
          </div>
        </section>
      )}

      {/* 熱門住宿 */}
      <section>
        <div className="sec-head">
          <div className="st"><h2 className="serif">{city}熱門住宿</h2>{total > 0 && <span className="count">{total} 間</span>}</div>
          <Link className="lnk" href={`/${enc(city)}/hotels`}>看全部 →</Link>
        </div>
        {rooms.length === 0 ? (
          <div className="empty">{city}目前還沒有上架民宿。<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>看看其他地區 →</Link></div>
        ) : (
          <div className="cards">{rooms.slice(0, 8).map((r) => <RoomTile key={r.id} r={r} />)}</div>
        )}
      </section>

      {/* 熱門景點 */}
      {attr.total > 0 && (
        <section style={{ marginTop: 40 }}>
          <div className="sec-head">
            <div className="st"><h2 className="serif">{city}熱門景點</h2><span className="count">{attr.total}</span></div>
            <Link className="lnk" href={`/${enc(city)}/attractions`}>看全部 →</Link>
          </div>
          {placeCards(city, "attraction", attr.places.slice(0, 4))}
        </section>
      )}

      {/* 人氣美食 */}
      {food.total > 0 && (
        <section style={{ marginTop: 40 }}>
          <div className="sec-head">
            <div className="st"><h2 className="serif">{city}人氣美食</h2><span className="count">{food.total}</span></div>
            <Link className="lnk" href={`/${enc(city)}/restaurants`}>看全部 →</Link>
          </div>
          {placeCards(city, "restaurant", food.places.slice(0, 4))}
        </section>
      )}

      {/* 其他城市 */}
      <section style={{ marginTop: 44, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>探索其他城市</h2>
        <div className="region-links">
          {others.map((c) => <Link key={c} href={`/${enc(c)}`} className="region-link">{c}</Link>)}
        </div>
      </section>
    </main>
  );
}
