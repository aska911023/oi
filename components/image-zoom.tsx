"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const clamp = (v: number) => Math.min(6, Math.max(1, v));

// 相簿 + 放大鏡:縮圖可左右切換,點放大鏡進全螢幕(＋/−/滾輪縮放、拖曳移動、雙擊切換、多張可左右換圖)。
export default function ImageZoom({ images, alt, imgClassName }: { images: string[]; alt?: string; imgClassName?: string }) {
  const imgs = images && images.length ? images : [""];
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const src = imgs[Math.min(idx, imgs.length - 1)];

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

  useEffect(() => {
    const el = overlayRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setScale((s) => clamp(s - e.deltaY * 0.0018 * s)); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

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
  const zoom = (f: number) => (e: React.MouseEvent) => { e.stopPropagation(); setScale((s) => clamp(s * f)); };
  const nav = (d: number) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => (i + d + imgs.length) % imgs.length); reset(); };
  const go = (k: number) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setIdx(k); };

  const multi = imgs.length > 1;

  return (
    <div className="imgzoom">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={imgClassName} src={src} alt={alt || ""} />
      {multi && (
        <>
          <button type="button" className="hc-arrow prev" onClick={nav(-1)} aria-label="上一張">‹</button>
          <button type="button" className="hc-arrow next" onClick={nav(1)} aria-label="下一張">›</button>
          <div className="hc-dots">
            {imgs.map((_, k) => <button key={k} className={k === idx ? "on" : ""} onClick={go(k)} aria-label={`第 ${k + 1} 張`} />)}
          </div>
        </>
      )}
      <button type="button" className="imgzoom-btn" onClick={() => setOpen(true)} aria-label="放大圖片" title="放大">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /><path d="M11 8v6M8 11h6" />
        </svg>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={overlayRef} className="imgzoom-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true"
          onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchMove={onMove} onTouchEnd={onUp}>
          <button type="button" className="imgzoom-close" onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-label="關閉">✕</button>
          <div className="imgzoom-zoombtns" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={zoom(1 / 1.4)} aria-label="縮小">−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button type="button" onClick={zoom(1.4)} aria-label="放大">＋</button>
          </div>
          <div className="imgzoom-hint">滾輪或 ＋ − 縮放 · 放大後可拖曳 · 雙擊切換{multi ? " · ‹ › 換圖" : ""}</div>
          {multi && <button type="button" className="imgzoom-nav prev" onClick={nav(-1)} aria-label="上一張">‹</button>}
          {multi && <button type="button" className="imgzoom-nav next" onClick={nav(1)} aria-label="下一張">›</button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="imgzoom-full" src={src} alt={alt || ""} draggable={false}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in", transition: dragging ? "none" : "transform .12s" }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); scale > 1 ? reset() : setScale(2.5); }}
            onMouseDown={onDown} onTouchStart={onDown} />
        </div>,
        document.body
      )}
    </div>
  );
}
