import type { Metadata } from "next";
import Link from "next/link";
import { getArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "旅遊攻略",
  description: "偶宿 O! 旅遊攻略 —— 城市玩法、一日遊、親子行程、季節限定,帶你把台灣玩透。",
  alternates: { canonical: "/guides" },
  openGraph: { title: "旅遊攻略｜偶宿 O!", description: "城市玩法、一日遊、親子行程、季節限定,怎麼玩看這裡。", url: "/guides", type: "website" },
};

export default async function GuidesPage() {
  const articles = await getArticles();
  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}><Link href="/" className="lnk">偶宿 O!</Link> · 旅遊攻略</nav>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>旅遊攻略</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 680, lineHeight: 1.7, marginBottom: 26 }}>城市玩法、一日遊、親子行程、季節限定 —— 怎麼玩,看這裡。</p>
      {articles.length === 0 ? (
        <div className="empty">攻略陸續上架中,敬請期待。</div>
      ) : (
        <div className="guide-grid">
          {articles.map((a) => (
            <Link key={a.id} href={`/guides/${a.slug || a.id}`} className="guide-card">
              <div className={"guide-cover" + (a.cover_image ? "" : " noimg")}>
                {a.cover_image
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.cover_image} alt={a.title} loading="lazy" />
                  : null}
                {a.tag && <span className="guide-tag">{a.tag}</span>}
              </div>
              <div className="guide-cardbody">
                {a.region && <div className="card-eyebrow">{a.region}</div>}
                <h2>{a.title}</h2>
                {a.excerpt && <p>{a.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
