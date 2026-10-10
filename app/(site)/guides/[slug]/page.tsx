import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticleBySlug } from "@/lib/articles";
import { renderMarkdown } from "@/lib/md";
import { breadcrumbLd } from "@/lib/seo";
import { decodeParam } from "@/lib/slug";
import Avatar from "@/components/avatar";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await getArticleBySlug(decodeParam((await params).slug));
  if (!a) return { title: "找不到攻略" };
  const description = (a.excerpt || a.body || "").replace(/[#*>\-\[\]]/g, "").slice(0, 150);
  const canonical = `/guides/${a.slug || a.id}`;
  return { title: a.title, description, alternates: { canonical }, openGraph: { title: a.title, description, url: canonical, type: "article", images: a.cover_image ? [a.cover_image] : undefined }, twitter: { card: "summary_large_image", title: a.title, description, images: a.cover_image ? [a.cover_image] : undefined } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArticleBySlug(decodeParam((await params).slug));
  if (!a) notFound();
  const html = renderMarkdown(a.body || "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt || undefined,
    image: a.cover_image || undefined,
    datePublished: a.created_at,
    dateModified: a.updated_at || a.created_at,
    author: a.author?.display_name ? { "@type": "Person", name: a.author.display_name } : { "@type": "Organization", name: "偶宿 O!" },
    publisher: { "@type": "Organization", name: "偶宿 O!", "@id": "https://www.oi-stay.com/#org" },
    mainEntityOfPage: `https://www.oi-stay.com/guides/${a.slug || a.id}`,
  };
  const crumbLd = breadcrumbLd([
    { name: "偶宿 O!", path: "/" },
    { name: "旅遊攻略", path: "/guides" },
    { name: a.title, path: `/guides/${a.slug || a.id}` },
  ]);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 760 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <nav className="card-eyebrow" style={{ marginBottom: 10 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · <Link href="/guides" className="lnk">旅遊攻略</Link>
        {a.region && <> · <Link href={`/${encodeURIComponent(a.region)}`} className="lnk">{a.region}</Link></>}
      </nav>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 10, lineHeight: 1.3 }}>{a.title}</h1>
      {a.author?.display_name && (
        <Link href={a.author_id ? `/u/${a.author_id}` : "#"} className="guide-author">
          <Avatar src={a.author.avatar_url} name={a.author.display_name} size={34} />
          <span>{a.author.display_name}</span>
        </Link>
      )}
      <div className="card-eyebrow" style={{ marginBottom: 18, marginTop: 8 }}>{a.tag && <span>{a.tag}</span>}{a.tag && a.region ? " · " : ""}{a.region && <span>{a.region}</span>}</div>
      {a.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="guide-hero" src={a.cover_image} alt={a.title} />
      )}
      <article className="guide-content" dangerouslySetInnerHTML={{ __html: html }} />
      {a.region && (
        <div style={{ marginTop: 34, borderTop: "1px solid var(--border)", paddingTop: 22 }}>
          <Link href={`/${encodeURIComponent(a.region)}`} className="btn btn-primary">看 {a.region} 的住宿・景點・地圖 →</Link>
        </div>
      )}
    </main>
  );
}
