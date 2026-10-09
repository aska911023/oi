"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS } from "@/lib/data";

type Res = { label: string; sub: string; href: string };
const CITIES = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const enc = encodeURIComponent;

// 全站搜尋 + 即時建議(城市 / 民宿 / 景點 / 美食)。
export default function SearchAutocomplete({ initialQ = "", autoFocus = false, placeholder = "搜尋城市、民宿、景點、美食…" }: { initialQ?: string; autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [kw, setKw] = useState(initialQ);
  const [res, setRes] = useState<Res[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = kw.trim();
    if (!q) { setRes([]); return; }
    const t = setTimeout(async () => {
      const out: Res[] = [];
      CITIES.filter((c) => c.includes(q)).slice(0, 3).forEach((c) => out.push({ label: `${c}旅遊`, sub: "城市", href: `/${enc(c)}` }));
      try {
        const sb = createClient();
        const like = `%${q.replace(/[%,()]/g, " ")}%`;
        const [st, at, fo] = await Promise.all([
          sb.from("stays").select("id,name,slug,region").eq("published", true).eq("approved", true).eq("visibility", "published").ilike("name", like).limit(5),
          sb.from("attractions").select("id,name,slug,region").eq("published", true).ilike("name", like).limit(4),
          sb.from("restaurants").select("id,name,slug,region").eq("published", true).ilike("name", like).limit(4),
        ]);
        type Row = { id: string; name: string; slug?: string; region: string };
        ((st.data || []) as Row[]).forEach((s) => out.push({ label: s.name, sub: `${s.region} · 民宿`, href: `/${enc(s.region)}/hotel/${enc(s.slug || s.id)}` }));
        ((at.data || []) as Row[]).forEach((p) => out.push({ label: p.name, sub: `${p.region} · 景點`, href: `/${enc(p.region)}/attraction/${enc(p.slug || p.id)}` }));
        ((fo.data || []) as Row[]).forEach((p) => out.push({ label: p.name, sub: `${p.region} · 美食`, href: `/${enc(p.region)}/restaurant/${enc(p.slug || p.id)}` }));
      } catch { /* ignore */ }
      setRes(out); setOpen(true); setActive(-1);
    }, 250);
    return () => clearTimeout(t);
  }, [kw]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onKey(e: React.KeyboardEvent) {
    if (!open || !res.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); setOpen(false); router.push(res[active].href); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="sac" ref={boxRef}>
      <span className="sac-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg></span>
      <input className="sac-input" value={kw} autoFocus={autoFocus} placeholder={placeholder}
        onChange={(e) => setKw(e.target.value)} onFocus={() => res.length && setOpen(true)} onKeyDown={onKey} aria-label="搜尋" />
      {open && res.length > 0 && (
        <div className="sac-menu">
          {res.map((r, i) => (
            <Link key={i} href={r.href} className={"sac-row" + (i === active ? " on" : "")} onClick={() => setOpen(false)}>
              <span className="sac-label">{r.label}</span><span className="sac-sub">{r.sub}</span>
            </Link>
          ))}
        </div>
      )}
      {open && kw.trim() && res.length === 0 && <div className="sac-menu"><div className="sac-empty">找不到「{kw}」,換個關鍵字試試。</div></div>}
    </div>
  );
}
