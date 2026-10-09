import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion, STAY_THEMES } from "@/lib/rooms";
import { isCity, SECTIONS, SECTION_SET, getCityPlaces, getCityTrips, getCityMapPoints, type Section } from "@/lib/city";
import { decodeParam } from "@/lib/slug";
import RoomTile from "@/components/room-tile";
import PlacesExplore from "@/components/places-explore";
import PlacesMap from "@/components/places-map";
import TripCard from "@/components/trip-card";
import type { PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEG_META: Record<Section, { word: string; kind?: PoiKind }> = {
  hotels: { word: "民宿住宿" },
  restaurants: { word: "美食餐廳", kind: "food" },
  attractions: { word: "景點", kind: "attraction" },
  parking: { word: "停車場", kind: "parking" },
  itineraries: { word: "旅遊行程" },
};

function cityCrumb(city: string) {
  return (
    <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
      <Link href="/" className="lnk">偶宿 O!</Link> · <Link href={`/${encodeURIComponent(city)}`} className="lnk">{city}</Link>
    </nav>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; seg: string }> }): Promise<Metadata> {
  const { city: rawCity, seg } = await params;
  const city = decodeParam(rawCity);
  if (!isCity(city) || !SECTION_SET.has(seg)) return { title: "找不到頁面" };
  const m = SEG_META[seg as Section];
  const title = `${city}${m.word}推薦`;
  const description = `精選${city}${m.word} —— 偶宿 O! 整理${city}在地${m.word}資訊,一站看齊,帶你輕鬆規劃${city}旅遊。`;
  const canonical = `/${encodeURIComponent(city)}/${seg}`;
  return { title, description, alternates: { canonical }, openGraph: { title: `${title}｜偶宿 O!`, description, url: canonical, type: "website" } };
}

function faqHotels(city: string, total: number) {
  return [
    { q: `${city}有哪些民宿可以選?`, a: `偶宿 O! 目前收錄 ${total} 間${city}民宿,涵蓋包棟、親子友善、海景度假與設計旅宿等類型,可依人數與預算篩選。` },
    { q: `${city}民宿怎麼訂房?`, a: `偶宿不經手訂房、不收服務費。在民宿頁面可直接透過官網或官方 LINE 聯繫民宿訂房,房價與空房以各民宿公告為準。` },
    { q: `${city}有包棟民宿嗎?`, a: `有。${city}可找到多間包棟方案,適合家庭出遊、朋友聚會或團體包場入住。` },
  ];
}

export default async function CitySectionPage({ params }: { params: Promise<{ city: string; seg: string }> }) {
  const { city: rawCity, seg } = await params;
  const city = decodeParam(rawCity);
  if (!isCity(city) || !SECTION_SET.has(seg)) notFound();
  const section = seg as Section;

  // ── 住宿 ──
  if (section === "hotels") {
    const { rooms, total } = await getRoomsByRegion(city);
    const faqs = faqHotels(city, total);
    const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
    return (
      <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
        {cityCrumb(city)}
        <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>{city}民宿推薦</h1>
        <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 26 }}>
          精選 {total} 間{city}民宿,涵蓋<b>包棟</b>、<b>親子友善</b>、<b>海景度假</b>與<b>設計旅宿</b>。偶宿 O! 直接帶你前往民宿官方訂房管道(官網 / LINE),不經手訂房、不收服務費。
        </p>
        {rooms.length === 0 ? (
          <div className="empty">{city}目前還沒有上架的民宿。<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>看看其他地區 →</Link></div>
        ) : (
          <div className="cards">{rooms.map((r) => <RoomTile key={r.id} r={r} />)}</div>
        )}
        <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>依類型找 {city} 民宿</h2>
          <div className="region-links">
            {STAY_THEMES.map((t) => <Link key={t.cat} href={`/${encodeURIComponent(city)}/hotels/${encodeURIComponent(t.cat)}`} className="region-link">{city}{t.name}</Link>)}
          </div>
        </section>
        <section className="faq-sec" style={{ marginTop: 46, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{city}民宿 常見問題</h2>
          {faqs.map((f, i) => <details className="faq-item" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>
        <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{city}其他分類</h2>
          <div className="region-links">
            {SECTIONS.filter((s) => s.seg !== "hotels").map((s) => <Link key={s.seg} href={`/${encodeURIComponent(city)}/${s.seg}`} className="region-link">{city}{s.label}</Link>)}
          </div>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </main>
    );
  }

  // ── 行程 ──
  if (section === "itineraries") {
    const trips = await getCityTrips(city);
    return (
      <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
        {cityCrumb(city)}
        <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>{city}旅遊行程推薦</h1>
        <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 26 }}>
          看看旅人怎麼玩{city} —— 住宿、景點、美食、停車串成一趟{city}行程,收藏後可一鍵複製成自己的規劃。
        </p>
        {trips.length === 0 ? (
          <div className="empty">{city}還沒有公開行程。<Link href="/plan" style={{ color: "var(--green)", textDecoration: "underline" }}>來規劃第一個 →</Link></div>
        ) : (
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {trips.map((t) => <TripCard key={t.id} trip={t} />)}
          </div>
        )}
        <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
          <div className="region-links">
            {SECTIONS.filter((s) => s.seg !== "itineraries").map((s) => <Link key={s.seg} href={`/${encodeURIComponent(city)}/${s.seg}`} className="region-link">{city}{s.label}</Link>)}
          </div>
        </section>
      </main>
    );
  }

  // ── 景點 / 美食 / 停車(places,沿用 PlacesExplore 鎖定縣市)──
  const kind = SEG_META[section].kind as PoiKind;
  const [{ places, total }, points] = await Promise.all([getCityPlaces(kind, city), getCityMapPoints(kind, city)]);
  const word = SEG_META[section].word;
  return (
    <main>
      <div className="shell" style={{ paddingTop: 100 }}>
        {cityCrumb(city)}
        <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>{city}{word}推薦</h1>
        <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7 }}>
          偶宿 O! 整理{city}在地{word}資訊,{total} 筆一站看齊,搭配{city}住宿一起安排更順。
        </p>
        <div className="region-links" style={{ marginTop: 14 }}>
          {SECTIONS.filter((s) => s.seg !== section).map((s) => <Link key={s.seg} href={`/${encodeURIComponent(city)}/${s.seg}`} className="region-link">{city}{s.label}</Link>)}
        </div>
        {points.length > 0 && <div className="map-sec"><PlacesMap points={points} height={380} /></div>}
      </div>
      <PlacesExplore places={places} total={total} kind={kind} lockedRegion={city} />
    </main>
  );
}
