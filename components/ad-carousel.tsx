"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Ad { id: string; title: string; image: string; link_url: string | null }

// 詳情頁中間的活動廣告輪播:撈該地區(+全站)已核准、檔期內的廣告,自動輪播。沒有則不顯示。
export default function AdCarousel({ region }: { region?: string | null }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const today = new Date().toLocaleDateString("en-CA");
    const regions = region ? [region, "all"] : ["all"];
    createClient().from("ad_campaigns")
      .select("id,title,image,link_url,start_date,end_date,sort")
      .eq("status", "approved").in("region", regions)
      .order("sort", { ascending: true }).limit(20)
      .then(({ data }) => {
        if (!alive) return;
        const live = ((data as (Ad & { start_date: string | null; end_date: string | null })[]) || [])
          .filter((a) => (!a.start_date || a.start_date <= today) && (!a.end_date || a.end_date >= today));
        setAds(live); setI(0);
      });
    return () => { alive = false; };
  }, [region]);

  useEffect(() => {
    if (ads.length <= 1) return;
    timer.current = setInterval(() => setI((x) => (x + 1) % ads.length), 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [ads.length]);

  if (ads.length === 0) return null;
  const cur = ads[i];
  const Inner = (
    <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 1", minHeight: 120, borderRadius: 14, overflow: "hidden", background: "#0f4a42" }}>
      <img src={cur.image} alt={cur.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {cur.title && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "22px 20px 14px", background: "linear-gradient(transparent, rgba(0,0,0,.55))", color: "#fff", fontWeight: 700, fontSize: 16 }}>{cur.title}</div>
      )}
      <span style={{ position: "absolute", top: 10, right: 12, fontSize: 10.5, letterSpacing: 1, color: "#fff", background: "rgba(0,0,0,.35)", padding: "2px 7px", borderRadius: 20 }}>廣告</span>
      {ads.length > 1 && (
        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
          {ads.map((_, k) => (
            <button key={k} aria-label={`第 ${k + 1} 張`} onClick={(e) => { e.preventDefault(); setI(k); }}
              style={{ width: 7, height: 7, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: k === i ? "#fff" : "rgba(255,255,255,.5)" }} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="shell" style={{ padding: "6px 0 18px" }}>
      {cur.link_url
        ? <a href={cur.link_url} target="_blank" rel="noopener noreferrer sponsored" style={{ display: "block" }}>{Inner}</a>
        : Inner}
    </div>
  );
}
