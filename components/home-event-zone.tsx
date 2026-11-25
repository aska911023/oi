"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// 首頁「活動專區」banner:只放付費的「活動廣告」(ad_campaigns,全站+已核准+檔期內)輪播曝光。
// 沒有任何上架中的廣告時,整區不顯示(純變現版位)。
interface Ad { id: string; title: string; image: string; link_url: string | null }

export default function HomeEventZone() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const today = new Date().toLocaleDateString("en-CA");
    createClient().from("ad_campaigns")
      .select("id,title,image,link_url,start_date,end_date,sort")
      .eq("status", "approved").in("region", ["all"])
      .order("sort", { ascending: true }).limit(12)
      .then(({ data }) => {
        if (!alive) return;
        const live = ((data as (Ad & { start_date: string | null; end_date: string | null })[]) || [])
          .filter((a) => a.image && (!a.start_date || a.start_date <= today) && (!a.end_date || a.end_date >= today));
        setAds(live); setI(0);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    timer.current = setInterval(() => setI((x) => (x + 1) % ads.length), 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [ads.length]);

  if (ads.length === 0) return null;
  const cur = ads[i];

  const Inner = (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 6", minHeight: 150, borderRadius: 16, overflow: "hidden", background: "#0f4a42" }}>
      <img src={cur.image} alt={cur.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "34px 22px 18px", background: "linear-gradient(transparent, rgba(0,0,0,.6))", color: "#fff" }}>
        <span style={{ fontSize: 11, letterSpacing: 1, background: "rgba(0,0,0,.4)", padding: "2px 9px", borderRadius: 20 }}>廣告</span>
        {cur.title && <div style={{ fontWeight: 700, fontSize: 19, marginTop: 8 }}>{cur.title}</div>}
      </div>
      {ads.length > 1 && (
        <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", gap: 6 }}>
          {ads.map((_, k) => (
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
      {cur.link_url
        ? <a href={cur.link_url} target="_blank" rel="noopener noreferrer sponsored" style={{ display: "block" }}>{Inner}</a>
        : Inner}
    </section>
  );
}
