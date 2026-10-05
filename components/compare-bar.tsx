"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useCompare } from "@/lib/compare-store";
import { priceLabel } from "@/lib/data";
import type { RoomCard } from "@/lib/types";

const ROWS: { label: string; render: (c: RoomCard) => React.ReactNode }[] = [
  { label: "民宿", render: (c) => c.stay_name },
  { label: "房型", render: (c) => c.room_name },
  { label: "風格", render: (c) => c.category },
  { label: "地區", render: (c) => `${c.region}${c.town ? " · " + c.town : ""}` },
  { label: "每晚", render: (c) => <strong style={{ color: "var(--green)" }}>{priceLabel(c.price)}</strong> },
  { label: "可住人數", render: (c) => `${c.capacity} 人` },
  { label: "床型", render: (c) => c.beds || "—" },
  { label: "特色", render: (c) => (c.tags && c.tags.length ? c.tags.join("、") : "—") },
  { label: "設施", render: (c) => c.amenities || "—" },
];

export default function CompareBar() {
  const { items, remove, clear } = useCompare();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="compare-bar">
        <div className="cb-thumbs">
          {items.map((c) => (
            <div className="cb-thumb" key={c.id} title={`${c.stay_name} · ${c.room_name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image ? <img src={c.image} alt="" /> : <div className="cb-ph" />}
              <button className="cb-x" onClick={() => remove(c.id)} aria-label="移除">✕</button>
            </div>
          ))}
        </div>
        <div className="cb-actions">
          <button className="lnk" onClick={clear}>清空</button>
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={items.length < 2}>
            比較 ({items.length})
          </button>
        </div>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div className="compare-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-head">
              <h2 className="serif">房型比較</h2>
              <button className="close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
            </div>
            <div className="cm-scroll">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th />
                    {items.map((c) => (
                      <th key={c.id}>
                        <div className="cm-colimg">{c.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image} alt={c.stay_name} /> : <div className="cb-ph" />}</div>
                        <button className="cm-remove" onClick={() => remove(c.id)}>移除</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label}>
                      <th>{row.label}</th>
                      {items.map((c) => <td key={c.id}>{row.render(c)}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <th>詳情</th>
                    {items.map((c) => (
                      <td key={c.id}><Link className="btn btn-ghost btn-sm" href={`/stay/${c.stay_id}`} onClick={() => setOpen(false)}>看民宿</Link></td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
