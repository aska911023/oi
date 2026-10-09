import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion, STAY_THEMES } from "@/lib/rooms";
import { isCity } from "@/lib/city";
import { decodeParam } from "@/lib/slug";
import RoomTile from "@/components/room-tile";

export const dynamic = "force-dynamic";

// P1:僅處理 /{city}/hotels/{主題}(住宿主題長尾頁)。
// 單數 entity 詳情(/{city}/hotel|restaurant|attraction|parking/{slug})於 P2 實作。
const themeByCat = (cat: string) => STAY_THEMES.find((t) => t.cat === cat);

export async function generateMetadata({ params }: { params: Promise<{ city: string; seg: string; sub: string }> }): Promise<Metadata> {
  const { city: rawCity, seg, sub } = await params;
  const city = decodeParam(rawCity);
  if (!isCity(city) || seg !== "hotels") return { title: "找不到頁面" };
  const t = themeByCat(decodeParam(sub));
  if (!t) return { title: "找不到頁面" };
  const title = `${city}${t.name}推薦`;
  const description = `精選${city}${t.name} —— 偶宿 O! 整理${city}的${t.name},一站看齊,直接前往民宿官方訂房管道。`;
  const canonical = `/${encodeURIComponent(city)}/hotels/${encodeURIComponent(t.cat)}`;
  return { title, description, alternates: { canonical }, openGraph: { title: `${title}｜偶宿 O!`, description, url: canonical, type: "website" } };
}

export default async function CityHotelsThemePage({ params }: { params: Promise<{ city: string; seg: string; sub: string }> }) {
  const { city: rawCity, seg, sub } = await params;
  const city = decodeParam(rawCity);
  if (!isCity(city) || seg !== "hotels") notFound();
  const t = themeByCat(decodeParam(sub));
  if (!t) notFound();
  const { rooms, total } = await getRoomsByRegion(city, t.cat);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · <Link href={`/${encodeURIComponent(city)}`} className="lnk">{city}</Link> · <Link href={`/${encodeURIComponent(city)}/hotels`} className="lnk">住宿</Link>
      </nav>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>{city}{t.name}推薦</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 26 }}>
        精選 {total} 間{city}{t.name}。偶宿 O! 直接帶你前往民宿官方訂房管道,不經手訂房、不收服務費。
      </p>
      {rooms.length === 0 ? (
        <div className="empty">{city}目前還沒有{t.name}。<Link href={`/${encodeURIComponent(city)}/hotels`} style={{ color: "var(--green)", textDecoration: "underline" }}>看全部{city}民宿 →</Link></div>
      ) : (
        <div className="cards">{rooms.map((r) => <RoomTile key={r.id} r={r} />)}</div>
      )}
      <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{city} 其他民宿類型</h2>
        <div className="region-links">
          {STAY_THEMES.filter((x) => x.cat !== t.cat).map((x) => <Link key={x.cat} href={`/${encodeURIComponent(city)}/hotels/${encodeURIComponent(x.cat)}`} className="region-link">{city}{x.name}</Link>)}
          <Link href={`/${encodeURIComponent(city)}/hotels`} className="region-link">{city}全部民宿</Link>
        </div>
      </section>
    </main>
  );
}
