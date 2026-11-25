import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PhotoCarousel from "@/components/photo-carousel";
import SaveBookmark from "@/components/save-bookmark";

export const dynamic = "force-dynamic";
const enc = encodeURIComponent;

interface H {
  id: string; slug: string; title: string; image: string; images: string[]; category: string;
  region: string; town: string; address: string; lat: number | null; lng: number | null;
  start_date: string | null; end_date: string | null; start_time: string; end_time: string;
  all_day: boolean; is_free: boolean; indoor: boolean; description: string; link_url: string;
}

async function load(slug: string): Promise<H | null> {
  const sb = await createClient();
  const { data } = await sb.from("happenings").select("*").eq("slug", slug).eq("published", true).eq("approved", true).maybeSingle();
  return (data as H) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const h = await load(slug);
  if (!h) return { title: "活動 | 偶宿 O!" };
  return { title: `${h.title} | 偶宿 O! 活動`, description: (h.description || `${h.region}${h.town} 的${h.category}活動`).slice(0, 120) };
}

function fmt(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "short" }); }

export default async function EventDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = await load(slug);
  if (!h) notFound();
  const sb = await createClient();
  const { data: nbRaw } = await sb.rpc("nearby_pois", { p_region: h.region, p_lat: h.lat ?? null, p_lng: h.lng ?? null, p_exclude: null, p_limit: 6 });
  const nb = (nbRaw || {}) as { hotels?: { id: string; name: string; slug?: string }[]; restaurants?: { id: string; name: string; slug?: string }[] };
  const imgs = h.images?.length ? h.images : (h.image ? [h.image] : []);
  const mapQ = enc((h.title + " " + h.region + h.town + h.address).trim());
  const dateText = h.start_date ? (h.end_date && h.end_date !== h.start_date ? `${fmt(h.start_date)} ～ ${fmt(h.end_date)}` : fmt(h.start_date)) : "長期 / 常態";
  const timeText = h.all_day ? "全天" : (h.start_time ? `${h.start_time}${h.end_time ? " – " + h.end_time : ""}` : "");

  const ld = { "@context": "https://schema.org", "@type": "Event", name: h.title, description: h.description || undefined,
    ...(h.start_date ? { startDate: h.start_date } : {}), ...(h.end_date ? { endDate: h.end_date } : {}),
    eventAttendanceMode: h.indoor ? "https://schema.org/OfflineEventAttendanceMode" : undefined,
    location: { "@type": "Place", name: (h.town || h.region), address: `${h.region}${h.town}${h.address}` },
    ...(imgs.length ? { image: imgs } : {}), ...(h.is_free ? { isAccessibleForFree: true } : {}) };

  return (
    <main className="shell" style={{ paddingTop: 92, paddingBottom: 54, maxWidth: 820 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        <Link href="/" className="lnk">偶宿 O!</Link> · <Link href="/events" className="lnk">活動</Link> · {h.category}
      </div>

      {imgs.length > 0 && <div className="shop-hero-c" style={{ position: "relative" }}><PhotoCarousel images={imgs} alt={h.title} /><SaveBookmark type="event" id={h.id} floating nextPath={`/events/${enc(h.slug)}`} /></div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
        <span style={{ fontSize: 12.5, color: "var(--green)", background: "var(--green-soft)", padding: "2px 10px", borderRadius: 20 }}>{h.category}</span>
        {h.is_free && <span style={{ fontSize: 12.5, color: "var(--accent-orange,#b4690e)", background: "#fff6e9", padding: "2px 10px", borderRadius: 20 }}>免費</span>}
        {h.indoor && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>☂ 室內 / 雨天備案</span>}
        {!imgs.length && <span style={{ marginLeft: "auto" }}><SaveBookmark type="event" id={h.id} nextPath={`/events/${enc(h.slug)}`} /></span>}
      </div>
      <h1 className="serif" style={{ margin: "8px 0 4px", fontSize: 30 }}>{h.title}</h1>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7, fontSize: 15 }}>
        <div>🗓️ <b>{dateText}</b>{timeText && <span>　🕒 {timeText}</span>}</div>
        <div>📍 {h.region}{h.town ? " · " + h.town : ""}{h.address ? " · " + h.address : ""}</div>
      </div>

      <div className="detail-actions" style={{ margin: "16px 0 4px" }}>
        {h.link_url && <a className="btn btn-primary" href={h.link_url} target="_blank" rel="noopener noreferrer">報名 / 官方頁 ↗</a>}
        <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`}>🗺 地圖導航</a>
      </div>

      {h.description && <p style={{ whiteSpace: "pre-line", lineHeight: 1.8, marginTop: 14, color: "var(--text-2)" }}>{h.description}</p>}

      <div className="notice" style={{ marginTop: 18 }}>活動資訊為參考,實際時間/報名請以主辦單位公告為準。</div>

      {((nb.hotels || []).length > 0 || (nb.restaurants || []).length > 0) && (
        <section style={{ marginTop: 30 }}>
          <h2 className="serif shop-h" style={{ marginBottom: 12 }}>順道一遊</h2>
          {(nb.hotels || []).length > 0 && (
            <div className="nearby-group"><div className="nearby-head"><span>附近民宿</span><Link className="lnk" href={`/${enc(h.region)}/hotels`}>更多 →</Link></div>
              <div className="nearby-chips">{(nb.hotels || []).map((x) => <Link key={x.id} className="am-chip" href={`/${enc(h.region)}/hotel/${enc(x.slug || x.id)}`}>{x.name}</Link>)}</div></div>
          )}
          {(nb.restaurants || []).length > 0 && (
            <div className="nearby-group"><div className="nearby-head"><span>附近美食</span><Link className="lnk" href={`/${enc(h.region)}/restaurants`}>更多 →</Link></div>
              <div className="nearby-chips">{(nb.restaurants || []).map((x) => <Link key={x.id} className="am-chip" href={`/${enc(h.region)}/restaurant/${enc(x.slug || x.id)}`}>{x.name}</Link>)}</div></div>
          )}
        </section>
      )}
    </main>
  );
}
