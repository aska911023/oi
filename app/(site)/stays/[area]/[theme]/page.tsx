import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion, STAY_THEMES } from "@/lib/rooms";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import RoomTile from "@/components/room-tile";

export const dynamic = "force-dynamic";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const themeOf = (cat: string) => STAY_THEMES.find((t) => t.cat === cat);
const url = (region: string, cat: string) => `/stays/${encodeURIComponent(region)}/${encodeURIComponent(cat)}`;

export async function generateMetadata({ params }: { params: Promise<{ area: string; theme: string }> }): Promise<Metadata> {
  const { area, theme } = await params;
  const region = decodeURIComponent(area);
  const cat = decodeURIComponent(theme);
  const t = themeOf(cat);
  if (!REGIONS.includes(region) || !t) return { title: "找不到頁面" };
  const { total } = await getRoomsByRegion(region, cat);
  const title = `${region}${t.name}推薦`;
  const description = `精選 ${total} 間${region}${t.name} —— 看房型、價格與周邊景點,直接聯繫民宿訂房。偶宿 O! 不經手訂房、不收服務費。`;
  return {
    title,
    description,
    alternates: { canonical: url(region, cat) },
    openGraph: { title: `${title}｜偶宿 O!`, description, url: url(region, cat), type: "website" },
    robots: total > 0 ? undefined : { index: false },
  };
}

function faqOf(region: string, name: string, total: number) {
  return [
    { q: `${region}${name}有哪些推薦?`, a: `偶宿 O! 目前收錄 ${total} 間${region}${name},可依人數、預算與周邊景點挑選,頁面會標示價格與可住人數。` },
    { q: `${region}${name}怎麼訂房?`, a: `偶宿不經手訂房、不收服務費。在民宿頁面可直接透過官網或官方 LINE 聯繫民宿,房價與空房以民宿公告為準。` },
    { q: `${region}${name}大概多少錢?`, a: `價格依民宿、房型與平假日而不同,每間頁面都會列出平日 / 假日 / 包棟等各時段價格,可直接比較。` },
  ];
}

export default async function ThemeStaysPage({ params }: { params: Promise<{ area: string; theme: string }> }) {
  const { area, theme } = await params;
  const region = decodeURIComponent(area);
  const cat = decodeURIComponent(theme);
  const t = themeOf(cat);
  if (!REGIONS.includes(region) || !t) notFound();
  const { rooms, total } = await getRoomsByRegion(region, cat);
  const faqs = faqOf(region, t.name, total);
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const otherThemes = STAY_THEMES.filter((x) => x.cat !== cat);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · <Link href={`/stays/${encodeURIComponent(region)}`} className="lnk">{region}民宿</Link> · {t.name}
      </nav>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>{region}{t.name}推薦</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 26 }}>
        精選 {total} 間{region}{t.name},看房型、價格與周邊景點,挑到喜歡的直接聯繫民宿訂房。偶宿 O! 不經手訂房、不收服務費。
      </p>

      {rooms.length === 0 ? (
        <div className="empty">{region}目前還沒有{t.name}。<Link href={`/stays/${encodeURIComponent(region)}`} style={{ color: "var(--green)", textDecoration: "underline" }}>看所有 {region} 民宿 →</Link></div>
      ) : (
        <div className="cards">
          {rooms.map((r) => <RoomTile key={r.id} r={r} />)}
        </div>
      )}

      <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{region} 其他類型民宿</h2>
        <div className="region-links">
          <Link href={`/stays/${encodeURIComponent(region)}`} className="region-link">全部 {region} 民宿</Link>
          {otherThemes.map((x) => <Link key={x.cat} href={url(region, x.cat)} className="region-link">{region}{x.name}</Link>)}
        </div>
      </section>

      <section className="faq-sec" style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{region}{t.name} 常見問題</h2>
        {faqs.map((f, i) => (
          <details className="faq-item" key={i}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </main>
  );
}
