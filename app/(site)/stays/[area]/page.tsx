import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomsByRegion } from "@/lib/rooms";
import { GEOGRAPHIC_AREAS, priceLabel } from "@/lib/data";
import type { RoomCard } from "@/lib/types";

export const dynamic = "force-dynamic";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const href = (r: string) => `/stays/${encodeURIComponent(r)}`;

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { area } = await params;
  const region = decodeURIComponent(area);
  if (!REGIONS.includes(region)) return { title: "找不到地區" };
  const { total } = await getRoomsByRegion(region);
  const title = `${region}民宿推薦`;
  const description = `精選 ${total} 間${region}民宿 —— 包棟、親子友善、海景與設計旅宿一次看齊。偶宿 O! 直接帶你前往民宿官方管道,不經手訂房、不收服務費。`;
  return {
    title,
    description,
    alternates: { canonical: href(region) },
    openGraph: { title: `${title}｜偶宿 O!`, description, url: href(region), type: "website" },
    robots: total > 0 ? undefined : { index: false }, // 沒有民宿的地區不收錄,避免薄頁
  };
}

function Card({ r }: { r: RoomCard }) {
  const img = (r.images && r.images[0]) || r.image || "";
  return (
    <div className="card-wrap">
      <Link href={`/stay/${r.stay_id}`} className="card">
        <div className={"photo" + (img ? "" : " noimg")}>
          {img
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={`${r.stay_name} — ${r.region}${r.town}${r.category}`} loading="lazy" />
            : <div className="photo-ph" />}
          <div className="card-badges">
            {r.kind === "whole" && <span className="cbadge cbadge-whole">包棟</span>}
            {r.ad_tier && r.ad_tier !== "free" && <span className="cbadge cbadge-feat">精選</span>}
          </div>
        </div>
        <div className="card-body">
          <div className="card-eyebrow">{r.region} · {r.town}<span className="dot" />{r.category}</div>
          <h3>{r.stay_name}</h3>
          <div className="card-desc">{r.room_name}</div>
          <div className="card-bottom"><strong>{priceLabel(r.price)} <small>/ 晚起</small></strong></div>
        </div>
      </Link>
    </div>
  );
}

function faqOf(region: string, total: number) {
  return [
    { q: `${region}有哪些民宿可以選?`, a: `偶宿 O! 目前收錄 ${total} 間${region}民宿,涵蓋包棟、親子友善、海景度假與設計旅宿等類型,可依人數與預算篩選。` },
    { q: `${region}民宿怎麼訂房?`, a: `偶宿不經手訂房、不收服務費。在民宿頁面可直接透過官網或官方 LINE 聯繫民宿訂房,房價與空房以各民宿公告為準。` },
    { q: `${region}有包棟民宿嗎?`, a: `有。${region}可找到多間包棟方案,適合家庭出遊、朋友聚會或團體包場入住,頁面會標示可住人數與各時段價格。` },
    { q: `${region}適合親子或帶寵物入住嗎?`, a: `可以。偶宿${region}民宿能用「親子友善」等標籤篩選,部分民宿也提供寵物友善、戲水池、烤肉等設施。` },
  ];
}

export default async function RegionStaysPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const region = decodeURIComponent(area);
  if (!REGIONS.includes(region)) notFound();
  const { rooms, total } = await getRoomsByRegion(region);
  const others = REGIONS.filter((r) => r !== region);
  const faqs = faqOf(region, total);
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · {region}民宿
      </nav>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>{region}民宿推薦</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 740, lineHeight: 1.7, marginBottom: 26 }}>
        精選 {total} 間{region}民宿,涵蓋<b>包棟</b>、<b>親子友善</b>、<b>海景度假</b>與<b>設計旅宿</b>。
        偶宿 O! 直接帶你前往民宿的官方訂房管道(官網 / LINE),不經手訂房、不收服務費。
      </p>

      {rooms.length === 0 ? (
        <div className="empty">{region}目前還沒有上架的民宿。<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>看看其他地區 →</Link></div>
      ) : (
        <div className="cards">
          {rooms.map((r) => <Card key={r.id} r={r} />)}
        </div>
      )}

      <section className="faq-sec" style={{ marginTop: 46, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{region}民宿 常見問題</h2>
        {faqs.map((f, i) => (
          <details className="faq-item" key={i}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>探索其他地區民宿</h2>
        <div className="region-links">
          {others.map((r) => <Link key={r} href={href(r)} className="region-link">{r}民宿</Link>)}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </main>
  );
}
