"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// 首頁「活動專區」banner:把近期活動(happenings)＋全站活動廣告(ad_campaigns)拉成一條輪播橫幅,
// 導流到 /events 活動專頁。沒有任何內容時整區不顯示。
interface Slide { id: string; title: string; image: string | null; href: string; tag: string; meta?: string; external?: boolean }

export default function HomeEventZone() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const today = new Date().toLocaleDateString("en-CA");
    (async () => {
      const sb = createClient();
      const [adsRes, hapRes] = await Promise.all([
        sb.from("ad_campaigns").select("id,title,image,link_url,start_date,end_date,sort").eq("status", "approved").in("region", ["all"]).order("sort").limit(10),
        sb.from("happenings").select("id,slug,title,image,images,region,town,category,start_date,end_date,featured").eq("published", true).eq("approved", true).order("featured", { ascending: false }).order("start_date").limit(12),
      ]);
      if (!alive) return;
      const ads: Slide[] = ((adsRes.data as { id: string; title: string; image: string; link_url: string | null; start_date: string | null; end_date: string | null }[]) || [])
        .filter((a) => (!a.start_date || a.start_date <= today) && (!a.end_date || a.end_date >= today) && a.image)
        .map((a) => ({ id: "ad" + a.id, title: a.title, image: a.image, href: a.link_url || "/events", tag: "廣告", external: !!a.link_url }));
      const haps: Slide[] = ((hapRes.data as { id: string; slug: string | null; title: string; image: string | null; images: string[] | null; region: string | null; start_date: string | null; end_date: string | null }[]) || [])
        .filter((h) => { const end = h.end_date || h.start_date; return !end || end >= today; })
        .map((h) => ({
          id: h.id, title: h.title,
          image: (h.images && h.images[0]) || h.image,
          href: `/events/${encodeURIComponent(h.slug || h.id)}`,
          tag: "活動",
          meta: [h.region, h.start_date ? h.start_date.slice(5).replace("-", "/") : ""].filter(Boolean).join(" · "),
        }));
      setSlides([...ads, ...haps].filter((s) => s.image).slice(0, 10));
      setI(0);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    timer.current = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [slides.length]);

  if (slides.length === 0) return null;
  const cur = slides[i];

  const Inner = (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 6", minHeight: 150, borderRadius: 16, overflow: "hidden", background: "#0f4a42" }}>
      {cur.image && <img src={cur.image} alt={cur.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "34px 22px 18px", background: "linear-gradient(transparent, rgba(0,0,0,.6))", color: "#fff" }}>
        <span style={{ fontSize: 11, letterSpacing: 1, background: cur.tag === "廣告" ? "rgba(0,0,0,.4)" : "var(--green, #17635a)", padding: "2px 9px", borderRadius: 20 }}>{cur.tag}</span>
        <div style={{ fontWeight: 700, fontSize: 19, marginTop: 8 }}>{cur.title}</div>
        {cur.meta && <div style={{ fontSize: 13, opacity: .9, marginTop: 2 }}>{cur.meta}</div>}
      </div>
      {slides.length > 1 && (
        <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", gap: 6 }}>
          {slides.map((_, k) => (
            <button key={k} aria-label={`第 ${k + 1} 則`} onClick={(e) => { e.preventDefault(); setI(k); }}
              style={{ width: 7, height: 7, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: k === i ? "#fff" : "rgba(255,255,255,.5)" }} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="shell" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>活動專區</h2>
        <Link href="/events" className="lnk" style={{ fontSize: 14.5 }}>看全部活動 →</Link>
      </div>
      {cur.external
        ? <a href={cur.href} target="_blank" rel="noopener noreferrer sponsored" style={{ display: "block" }}>{Inner}</a>
        : <Link href={cur.href} style={{ display: "block" }}>{Inner}</Link>}
    </section>
  );
}
