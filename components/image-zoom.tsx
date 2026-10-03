"use client";

import { useEffect, useState } from "react";

// 圖片右下角放大鏡,點了用全螢幕 lightbox 看完整圖(contain,不裁切)。
export default function ImageZoom({ src, alt, imgClassName }: { src: string; alt?: string; imgClassName?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

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
        <div className="imgzoom-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <button className="imgzoom-close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="imgzoom-full" src={src} alt={alt || ""} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
