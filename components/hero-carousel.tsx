"use client";

import { useEffect, useRef, useState } from "react";
import { imgUrl } from "@/lib/img";

export default function HeroCarousel({ images, caption, height, links }: { images: string[]; caption?: string; height?: number; links?: string[] }) {
  const imgs = (images && images.length ? images : [""]).map((s) => imgUrl(s));
  const [i, setI] = useState(0);
  const prev = useRef(0); // 前一張墊底不動,新圖在上方浮現蓋上(避免露底的生硬感)
  const goTo = (next: (x: number) => number) => setI((x) => { prev.current = x; return next(x); });
  const href = links?.[i]?.trim();

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => goTo((x) => (x + 1) % imgs.length), 4500);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <div className="disc-img hero-carousel" style={height ? { height } : undefined}>
      {imgs.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={src} alt="民宿情境" className={"hc-slide" + (k === i ? " on" : k === prev.current ? " under" : "")} />
      ))}
      {href && (
        <a className="hc-linkover" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" aria-label="前往" />
      )}
      {caption && <span>{caption}</span>}
      {imgs.length > 1 && (
        <div className="hc-dots">
          {imgs.map((_, k) => (
            <button key={k} className={k === i ? "on" : ""} onClick={() => goTo(() => k)} aria-label={`第 ${k + 1} 張`} />
          ))}
        </div>
      )}
    </div>
  );
}
