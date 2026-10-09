import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion, STAY_THEMES } from "@/lib/rooms";
import { isCity, ENTITY_KIND, stayHref, placeHref, getStayBySlug, getPlaceBySlug } from "@/lib/city";
import { decodeParam } from "@/lib/slug";
import RoomTile from "@/components/room-tile";
import StayDetail from "@/components/stay-detail";
import PlaceDetail from "@/components/place-detail";
import type { PoiKind, Stay, Place } from "@/lib/types";

export const dynamic = "force-dynamic";

// /{city}/hotels/{主題}      → 住宿主題長尾頁
// /{city}/hotel/{slug}       → 民宿詳情
// /{city}/{attraction|restaurant|parking}/{slug} → 景點/美食/停車 詳情
const themeByCat = (cat: string) => STAY_THEMES.find((t) => t.cat === cat);
const KIND_LABEL: Record<PoiKind, string> = { attraction: "景點", food: "美食", parking: "停車" };
const firstImg = (image?: string, images?: string[]) => (images && images[0]) || image || undefined;

export async function generateMetadata({ params }: { params: Promise<{ city: string; seg: string; sub: string }> }): Promise<Metadata> {
  const { city: rawCity, seg, sub } = await params;
  const city = decodeParam(rawCity);
  if (!isCity(city)) return { title: "找不到頁面" };
  const slug = decodeParam(sub);

  if (seg === "hotels") {
    const t = themeByCat(slug);
    if (!t) return { title: "找不到頁面" };
    const title = `${city}${t.name}推薦`;
    const description = `精選${city}${t.name} —— 偶宿 O! 整理${city}的${t.name},一站看齊,直接前往民宿官方訂房管道。`;
    const canonical = `/${encodeURIComponent(city)}/hotels/${encodeURIComponent(t.cat)}`;
    return { title, description, alternates: { canonical }, openGraph: { title: `${title}｜偶宿 O!`, description, url: canonical, type: "website" } };
  }

  if (seg === "hotel") {
    const s = await getStayBySlug(slug);
    if (!s) return { title: "找不到民宿" };
    const place = `${s.region || ""}${s.town || ""}`;
    const title = `${s.name} · ${place}${s.category || "民宿"}`;
    const description = (s.description || `位於${place}的${s.category || "民宿"}「${s.name}」。在偶宿 O! 看房型、價格與周邊景點,一鍵聯繫訂房。`).slice(0, 150);
    const img = firstImg(s.image, s.images);
    const canonical = stayHref(s.region, s.slug || s.id);
    return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website", images: img ? [img] : undefined }, twitter: { card: "summary_large_image", title, description, images: img ? [img] : undefined } };
  }

  const kind = ENTITY_KIND[seg];
  if (kind) {
    const p = await getPlaceBySlug(kind, slug);
    if (!p) return { title: "找不到頁面" };
    const where = `${p.region || ""}${p.town || ""}`;
    const title = `${p.name} · ${where}${KIND_LABEL[kind]}`;
    const description = (p.description || `位於${where}的${KIND_LABEL[kind]}「${p.name}」。偶宿 O! 整理地址、營業資訊與周邊住宿,帶你順路一起玩。`).slice(0, 150);
    const img = firstImg(p.image, p.images);
    const canonical = placeHref(kind, p.region, p.slug || p.id);
    return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website", images: img ? [img] : undefined } };
  }

  return { title: "找不到頁面" };
}

export default async function CityEntityPage({ params }: { params: Promise<{ city: string; seg: string; sub: string }> }) {
  const { city: rawCity, seg, sub } = await params;
  const city = decodeParam(rawCity);
  if (!isCity(city)) notFound();
  const slug = decodeParam(sub);

  // ── 住宿主題長尾 ──
  if (seg === "hotels") {
    const t = themeByCat(slug);
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

  // ── 民宿詳情 ──
  if (seg === "hotel") {
    const s: Stay | null = await getStayBySlug(slug);
    if (!s) notFound();
    return <StayDetail stay={s} />;
  }

  // ── 景點 / 美食 / 停車 詳情 ──
  const kind = ENTITY_KIND[seg];
  if (kind) {
    const p: Place | null = await getPlaceBySlug(kind, slug);
    if (!p) notFound();
    return <PlaceDetail place={p} kind={kind} />;
  }

  notFound();
}
