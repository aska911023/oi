"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FRAME = 280;
const OUT = 400;

// 頭貼裁切:圓形框內拖曳移動 + 滑桿縮放,套用後輸出 400x400 JPEG。
export default function AvatarCropper({ file, onCancel, onCropped }: { file: File; onCancel: () => void; onCropped: (blob: Blob) => void }) {
  const [url, setUrl] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  const baseScale = nat.w && nat.h ? FRAME / Math.min(nat.w, nat.h) : 1;
  const disp = baseScale * zoom;
  const dispW = nat.w * disp, dispH = nat.h * disp;

  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(FRAME - dispW, p.x)),
    y: Math.min(0, Math.max(FRAME - dispH, p.y)),
  });

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const im = e.currentTarget;
    const w = im.naturalWidth, h = im.naturalHeight;
    const bs = FRAME / Math.min(w, h);
    setNat({ w, h });
    setZoom(1);
    setPos({ x: (FRAME - w * bs) / 2, y: (FRAME - h * bs) / 2 });
  }

  useEffect(() => { setPos((p) => clamp(p)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [zoom, nat.w, nat.h]);

  const pt = (e: React.MouseEvent | React.TouchEvent) => ("touches" in e ? e.touches[0] : e);
  const onDown = (e: React.MouseEvent | React.TouchEvent) => { const p = pt(e); drag.current = { x: p.clientX, y: p.clientY, px: pos.x, py: pos.y }; };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current) return;
    const p = pt(e);
    setPos(clamp({ x: drag.current.px + (p.clientX - drag.current.x), y: drag.current.py + (p.clientY - drag.current.y) }));
  };
  const onUp = () => { drag.current = null; };

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = FRAME / disp;
    ctx.drawImage(img, -pos.x / disp, -pos.y / disp, s, s, 0, 0, OUT, OUT);
    canvas.toBlob((b) => { if (b) onCropped(b); }, "image/jpeg", 0.9);
  }

  return createPortal(
    <div className="cropper-overlay" onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchMove={onMove} onTouchEnd={onUp}>
      <div className="cropper-box" onClick={(e) => e.stopPropagation()}>
        <div className="cropper-title">調整頭貼</div>
        <div className="cropper-frame" onMouseDown={onDown} onTouchStart={onDown}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img ref={imgRef} src={url} alt="" onLoad={onLoad} draggable={false}
            style={{ position: "absolute", width: dispW, height: dispH, left: pos.x, top: pos.y, maxWidth: "none", userSelect: "none" }} />}
          <div className="cropper-mask" />
        </div>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="縮放" />
        <div className="cropper-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-primary btn-sm" onClick={confirm}>套用</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
