"use client";

import { useEffect, useState } from "react";

export default function HeroCarousel({ images, caption, height, links }: { images: string[]; caption?: string; height?: number; links?: string[] }) {
  const imgs = images && images.length ? images : [""];
  const [i, setI] = useState(0);
  const href = links?.[i]?.trim();

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % imgs.length), 4500);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <div className="disc-img" style={height ? { height } : undefined}>
      {imgs.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={src} alt="民宿情境" className={"hc-slide" + (k === i ? " on" : "")} />
      ))}
      {href && (
        <a className="hc-linkover" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" aria-label="前往" />
      )}
      {caption && <span>{caption}</span>}
      {imgs.length > 1 && (
        <div className="hc-dots">
          {imgs.map((_, k) => (
            <button key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`第 ${k + 1} 張`} />
          ))}
        </div>
      )}
    </div>
  );
}
