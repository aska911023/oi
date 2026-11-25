"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GEOGRAPHIC_AREAS } from "@/lib/data";

export interface EventItem {
  id: string; slug?: string; title: string; image: string; category: string;
  region: string; town: string; start_date: string | null; end_date: string | null;
  start_time: string; is_free: boolean; indoor: boolean;
}
const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const CATS = ["市集", "手作體驗", "展覽", "親子", "季節活動", "音樂表演", "運動", "講座"];
const WK = ["日", "一", "二", "三", "四", "五", "六"];

function DateChip({ d }: { d: string | null }) {
  if (!d) return <div style={{ flex: "none", width: 50, textAlign: "center", background: "var(--green-soft)", borderRadius: 10, padding: "6px 0", color: "var(--green)" }}><div style={{ fontSize: 11, fontWeight: 700 }}>長期</div></div>;
  const dt = new Date(d + "T00:00:00");
  return (
    <div style={{ flex: "none", width: 50, textAlign: "center", background: "var(--green-soft)", borderRadius: 10, padding: "5px 0", color: "var(--green)" }}>
      <div style={{ fontSize: 10.5 }}>{dt.getMonth() + 1} 月</div>
      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.05 }}>{dt.getDate()}</div>
      <div style={{ fontSize: 10.5 }}>週{WK[dt.getDay()]}</div>
    </div>
  );
}

function Card({ e }: { e: EventItem }) {
  const href = e.slug ? `/events/${encodeURIComponent(e.slug)}` : "#";
  const range = e.start_date && e.end_date && e.end_date !== e.start_date ? ` – ${new Date(e.end_date + "T00:00:00").toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}` : "";
  return (
    <Link href={href} className="ev-card" style={{ display: "flex", gap: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", textDecoration: "none", color: "var(--text)" }}>
      <DateChip d={e.start_date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
          <span style={{ fontSize: 11.5, color: "var(--green)", background: "var(--green-soft)", padding: "1px 7px", borderRadius: 20 }}>{e.category}</span>
          {e.is_free && <span style={{ fontSize: 11.5, color: "var(--accent-orange,#b4690e)", background: "#fff6e9", padding: "1px 7px", borderRadius: 20 }}>免費</span>}
          {e.indoor && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>☂ 雨天備案</span>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
          📍 {e.region}{e.town ? " · " + e.town : ""}{e.start_time ? `　🕒 ${e.start_time}` : ""}{range && <span>{range}</span>}
        </div>
      </div>
      {e.image && <img src={e.image} alt="" style={{ flex: "none", width: 84, height: 84, objectFit: "cover", borderRadius: 10 }} />}
    </Link>
  );
}

export default function EventsExplore({ events }: { events: EventItem[] }) {
  const [region, setRegion] = useState("all");
  const [cat, setCat] = useState("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [indoorOnly, setIndoorOnly] = useState(false);

  const filtered = useMemo(() => events.filter((e) =>
    (region === "all" || e.region === region) && (cat === "all" || e.category === cat) &&
    (!freeOnly || e.is_free) && (!indoorOnly || e.indoor)), [events, region, cat, freeOnly, indoorOnly]);

  const { thisWeek, upcoming, ongoing } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const wk = new Date(today); wk.setDate(wk.getDate() + 7);
    const g = { thisWeek: [] as EventItem[], upcoming: [] as EventItem[], ongoing: [] as EventItem[] };
    for (const e of filtered) {
      if (!e.start_date) { g.ongoing.push(e); continue; }
      const sd = new Date(e.start_date + "T00:00:00");
      if (sd <= wk) g.thisWeek.push(e); else g.upcoming.push(e);
    }
    return g;
  }, [filtered]);

  const chip = (active: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: 20, border: "1px solid " + (active ? "var(--green)" : "var(--border)"), background: active ? "var(--green)" : "transparent", color: active ? "#fff" : "var(--text-2)", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" });

  const Section = ({ title, items }: { title: string; items: EventItem[] }) => items.length === 0 ? null : (
    <section style={{ marginTop: 30 }}>
      <h2 className="serif shop-h" style={{ marginBottom: 14 }}>{title} <span className="count">{items.length}</span></h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {items.map((e) => <Card key={e.id} e={e} />)}
      </div>
    </section>
  );

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface,#fff)" }}>
          <option value="all">全部地區</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button style={chip(cat === "all")} onClick={() => setCat("all")}>全部類型</button>
        {CATS.map((c) => <button key={c} style={chip(cat === c)} onClick={() => setCat(cat === c ? "all" : c)}>{c}</button>)}
        <button style={chip(freeOnly)} onClick={() => setFreeOnly(!freeOnly)}>免費</button>
        <button style={chip(indoorOnly)} onClick={() => setIndoorOnly(!indoorOnly)}>室內 / 雨天備案</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty" style={{ marginTop: 28 }}>這個條件目前沒有活動,換個篩選看看 🙂</div>
      ) : (
        <>
          <Section title="本週活動" items={thisWeek} />
          <Section title="即將登場" items={upcoming} />
          <Section title="長期 / 常態" items={ongoing} />
        </>
      )}
    </>
  );
}
