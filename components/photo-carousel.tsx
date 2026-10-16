"use client";

import { useEffect, useRef, useState } from "react";
import { imgUrl } from "@/lib/img";

// 輕量輪播:把 slides + 箭頭 + dots 直接塞進外層定位容器(.photo / .shop-hero-c / .room-thumb-c)。
// 單張時等同一張靜態圖;多張時自動輪播,可左右箭頭/圓點切換(含 stopPropagation,卡片包在 Link 裡也不會誤跳轉)。
export default function PhotoCarousel({ images, alt, dots = true, arrows = true, interval = 4000, width }: {
  images: string[]; alt?: string; dots?: boolean; arrows?: boolean; interval?: number;
  /** 給卡片用:跟 Storage 要指定寬度的縮圖(CDN 會快取),省流量也載得快 */
  width?: number;
}) {
  const imgs = (images && images.length ? images : [""]).map((s) => imgUrl(s, width));
  const [i, setI] = useState(0);
  const prev = useRef(0); // 前一張:切換時墊在底下不動,等新圖浮現蓋上去(避免交叉淡化露底的生硬感)
  const goTo = (next: (x: number) => number) => setI((x) => { prev.current = x; return next(x); });

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => goTo((x) => (x + 1) % imgs.length), interval);
    return () => clearInterval(t);
  }, [imgs.length, interval]);

  const go = (d: number) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    goTo((x) => (x + d + imgs.length) % imgs.length);
  };

  return (
    <>
      {imgs.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={src} alt={alt || ""} loading="lazy" className={"hc-slide" + (k === i ? " on" : k === prev.current ? " under" : "")} />
      ))}
      {arrows && imgs.length > 1 && (
        <>
          <button className="hc-arrow prev" onClick={go(-1)} aria-label="上一張">‹</button>
          <button className="hc-arrow next" onClick={go(1)} aria-label="下一張">›</button>
        </>
      )}
      {dots && imgs.length > 1 && (
        <div className="hc-dots">
          {imgs.map((_, k) => (
            <button key={k} className={k === i ? "on" : ""} aria-label={`第 ${k + 1} 張`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(() => k); }} />
          ))}
        </div>
      )}
    </>
  );
}
