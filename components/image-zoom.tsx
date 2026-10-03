"use client";

import { useEffect, useRef, useState } from "react";

// 圖片右下角放大鏡 → 全螢幕 lightbox:滾輪縮放、滑鼠拖曳移動、雙擊還原。
export default function ImageZoom({ src, alt, imgClassName }: { src: string; alt?: string; imgClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  useEffect(() => {
    if (!open) return;
    reset();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  // 滾輪縮放(非 passive 才能 preventDefault)
  useEffect(() => {
    const el = imgRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.min(6, Math.max(1, s - e.deltaY * 0.0016 * s)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  // 縮回 1 倍時自動置中
  useEffect(() => { if (scale <= 1) setPos({ x: 0, y: 0 }); }, [scale]);

  const pt = (e: React.MouseEvent | React.TouchEvent) => ("touches" in e ? e.touches[0] : e);
  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (scale <= 1) return;
    const p = pt(e);
    drag.current = { x: p.clientX, y: p.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current) return;
    const p = pt(e);
    setPos({ x: drag.current.px + (p.clientX - drag.current.x), y: drag.current.py + (p.clientY - drag.current.y) });
  };
  const onUp = () => { drag.current = null; setDragging(false); };

  return (
    <div className="imgzoom">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={imgClassName} src={src} alt={alt || ""} />
      <button type="button" className="imgzoom-btn" onClick={() => setOpen(true)} aria-label="放大圖片" title="放大">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /><path d="M11 8v6M8 11h6" />
        </svg>
      </button>
      {open && (
        <div className="imgzoom-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true"
          onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchMove={onMove} onTouchEnd={onUp}>
          <button type="button" className="imgzoom-close" onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-label="關閉">✕</button>
          <div className="imgzoom-hint">滾輪縮放 · 拖曳移動 · 雙擊還原</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} className="imgzoom-full" src={src} alt={alt || ""} draggable={false}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default", transition: dragging ? "none" : "transform .12s" }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); scale > 1 ? reset() : setScale(2.5); }}
            onMouseDown={onDown} onTouchStart={onDown} />
        </div>
      )}
    </div>
  );
}
