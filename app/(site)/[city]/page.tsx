import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion } from "@/lib/rooms";
import { isCity, CITIES, SECTIONS } from "@/lib/city";
import { decodeParam } from "@/lib/slug";
import RoomTile from "@/components/room-tile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = decodeParam((await params).city);
  if (!isCity(city)) return { title: "找不到城市" };
  const title = `${city}旅遊｜住宿・景點・美食・停車・行程`;
  const description = `${city}旅遊一站整理:精選${city}民宿住宿、必去景點、在地美食、停車資訊與推薦行程。偶宿 O! 帶你從「想去哪裡」到「怎麼玩」。`;
  const canonical = `/${encodeURIComponent(city)}`;
  return { title, description, alternates: { canonical }, openGraph: { title: `${title}｜偶宿 O!`, description, url: canonical, type: "website" } };
}

export default async function CityHub({ params }: { params: Promise<{ city: string }> }) {
  const city = decodeParam((await params).city);
  if (!isCity(city)) notFound();
  const { rooms, total } = await getRoomsByRegion(city);
  const others = CITIES.filter((c) => c !== city);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · {city}
      </nav>
      <h1 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>{city}旅遊</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 24 }}>
        {city}的<b>住宿</b>、<b>景點</b>、<b>美食</b>、<b>停車</b>與<b>行程</b>,偶宿 O! 一次幫你整理好 —— 從「想去哪裡」到「怎麼玩」。
      </p>

      {/* 分類導覽 */}
      <div className="region-links" style={{ marginBottom: 32 }}>
        {SECTIONS.map((s) => (
          <Link key={s.seg} href={`/${encodeURIComponent(city)}/${s.seg}`} className="region-link">{city}{s.label}</Link>
        ))}
      </div>

      {/* 熱門住宿 */}
      <section>
        <div className="sec-head">
          <div className="st"><h2 className="serif">{city}熱門住宿</h2>{total > 0 && <span className="count">{total} 間</span>}</div>
          <Link className="lnk" href={`/${encodeURIComponent(city)}/hotels`}>看全部 →</Link>
        </div>
        {rooms.length === 0 ? (
          <div className="empty">{city}目前還沒有上架民宿。<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>看看其他地區 →</Link></div>
        ) : (
          <div className="cards">{rooms.slice(0, 8).map((r) => <RoomTile key={r.id} r={r} />)}</div>
        )}
      </section>

      {/* 其他城市 */}
      <section style={{ marginTop: 44, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>探索其他城市</h2>
        <div className="region-links">
          {others.map((c) => <Link key={c} href={`/${encodeURIComponent(c)}`} className="region-link">{c}</Link>)}
        </div>
      </section>
    </main>
  );
}
