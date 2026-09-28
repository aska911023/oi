"use client";

import { useEffect, useState } from "react";

export default function HeroCarousel({ images, caption }: { images: string[]; caption?: string }) {
  const imgs = images && images.length ? images : [""];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % imgs.length), 4500);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <div className="disc-img">
      {imgs.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={src} alt="民宿情境" className={"hc-slide" + (k === i ? " on" : "")} />
      ))}
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
