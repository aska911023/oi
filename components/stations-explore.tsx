"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { POI_KINDS, type Station } from "@/lib/types";
import AddToTrip from "@/components/add-to-trip";

const TAB_LABEL: Record<string, string> = { attraction: "景點", food: "美食", parking: "停車" };

export default function StationsExplore({ stations }: { stations: Station[] }) {
  const [kind, setKind] = useState<"all" | "hsr" | "tra">("all");
  const [region, setRegion] = useState("all");

  const results = useMemo(() => stations.filter((s) => {
    if (kind !== "all" && s.kind !== kind) return false;
    if (region !== "all" && s.region !== region) return false;
    return true;
  }), [stations, kind, region]);

  const mapHref = (s: Station) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((s.kind === "hsr" ? "高鐵" : "台鐵") + s.name + "站")}`;

  return (
    <>
      <section className="disc">
        <div className="shell">
          <div className="places-tabs">
            {POI_KINDS.map((k) => <Link key={k.slug} href={`/places/${k.slug}`} className="chip">{TAB_LABEL[k.kind]}</Link>)}
            <Link href="/rentals" className="chip">租車</Link>
            <span className="chip on">車站</span>
          </div>
          <div className="places-head">
            <h1 className="serif">車站</h1>
            <p>高鐵與台鐵車站——安排行程時當交通起點 / 終點。</p>
          </div>

          <div className="disc-filters">
            <div className="filter-row">
              <span className="filter-cap">系統</span>
              <select className="region-select" value={kind} onChange={(e) => setKind(e.target.value as "all" | "hsr" | "tra")} aria-label="系統">
                <option value="all">高鐵 + 台鐵</option>
                <option value="hsr">只看高鐵</option>
                <option value="tra">只看台鐵</option>
              </select>
            </div>
            <div className="filter-row">
              <span className="filter-cap">縣市</span>
              <select className="region-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="縣市">
                <option value="all">全部地區</option>
                {GEOGRAPHIC_AREAS.map((a) => <optgroup key={a.name} label={a.name}>{a.regions.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="sec-head"><div className="st"><h2 className="serif">車站</h2><span className="count">{results.length} 站</span></div></div>
        <div className="station-grid">
          {results.length === 0 && <div className="empty">沒有符合的車站。</div>}
          {results.map((s) => (
            <div key={s.id} className="station-chip">
              <a className="st-link" href={mapHref(s)} target="_blank" rel="noopener noreferrer">
                <span className={"st-badge " + s.kind}>{s.kind === "hsr" ? "高鐵" : "台鐵"}</span>
                <span className="st-name">{s.name}</span>
                <small>{s.region}</small>
              </a>
              <AddToTrip type="station" refId={s.id} name={(s.kind === "hsr" ? "高鐵" : "台鐵") + s.name} region={s.region} compact />
            </div>
          ))}
        </div>
        <p className="sample-note">點車站可在 Google 地圖開啟。</p>
      </div>
    </>
  );
}
