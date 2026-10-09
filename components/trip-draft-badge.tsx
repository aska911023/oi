"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// 浮動「行程草稿籃」(購物車式):點開看清單、逐項 ✕ 刪、清空、去規劃。
// 草稿存 localStorage oi_trip_draft;靠自訂事件 oi-trip-draft 即時同步。
const KEY = "oi_trip_draft";
type DraftItem = { type: string; refId: string; name: string; region?: string };
const LABEL: Record<string, string> = { stay: "住宿", attraction: "景點", food: "美食", parking: "停車", rental: "租車", station: "車站" };

function read(): DraftItem[] {
  try { const r = localStorage.getItem(KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
function write(arr: DraftItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  window.dispatchEvent(new Event("oi-trip-draft"));
}

export default function TripDraftBadge() {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setItems(read());
    update();
    window.addEventListener("oi-trip-draft", update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("oi-trip-draft", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!items.length) return null;

  const removeAt = (i: number) => { const next = items.filter((_, x) => x !== i); write(next); if (!next.length) setOpen(false); };
  const clearAll = () => { write([]); setOpen(false); };

  return (
    <div className="tripdraft-wrap" ref={ref}>
      {open && (
        <div className="tripdraft-pop" role="dialog" aria-label="行程草稿">
          <div className="tdp-head"><b>行程草稿</b><span>{items.length} 個</span></div>
          <div className="tdp-list">
            {items.map((it, i) => (
              <div className="tdp-row" key={it.type + it.refId}>
                <span className="tdp-tag">{LABEL[it.type] || "項目"}</span>
                <span className="tdp-nm">{it.name}</span>
                <button type="button" className="tdp-del" onClick={() => removeAt(i)} aria-label="移除">✕</button>
              </div>
            ))}
          </div>
          <div className="tdp-foot">
            <button type="button" className="lnk danger" onClick={clearAll}>清空</button>
            <Link href="/plan" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>去規劃 →</Link>
          </div>
        </div>
      )}
      <button type="button" className="tripdraft" onClick={() => setOpen((o) => !o)} title="查看行程草稿">
        <span className="td-ic" aria-hidden="true">🧳</span>
        <span className="td-tx">行程草稿</span>
        <span className="td-n">{items.length}</span>
      </button>
    </div>
  );
}
