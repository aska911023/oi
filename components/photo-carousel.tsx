"use client";

import { useEffect, useState } from "react";

// 輕量輪播:把 slides + dots 直接塞進外層定位容器(.photo / .shop-hero-c / .room-thumb-c)。
// 單張時等同一張靜態圖;多張時自動輪播,可點圓點切換(含 stopPropagation,卡片包在 Link 裡也不會誤跳轉)。
export default function PhotoCarousel({ images, alt, dots = true, interval = 4000 }: {
  images: string[]; alt?: string; dots?: boolean; interval?: number;
}) {
  const imgs = images && images.length ? images : [""];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % imgs.length), interval);
    return () => clearInterval(t);
  }, [imgs.length, interval]);

  return (
    <>
      {imgs.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={src} alt={alt || ""} loading="lazy" className={"hc-slide" + (k === i ? " on" : "")} />
      ))}
      {dots && imgs.length > 1 && (
        <div className="hc-dots">
          {imgs.map((_, k) => (
            <button key={k} className={k === i ? "on" : ""} aria-label={`第 ${k + 1} 張`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setI(k); }} />
          ))}
        </div>
      )}
    </>
  );
}
