"use client";

import { useEffect } from "react";

function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function ttId(url: string): string | null {
  const m = url.match(/tiktok\.com\/(?:@[\w.]+\/video\/|embed\/v2\/|embed\/|v\/)(\d+)/);
  return m ? m[1] : null;
}
const isIg = (url: string) => /instagram\.com\/(p|reel|tv)\//i.test(url);

declare global {
  interface Window { instgrm?: { Embeds?: { process: () => void } } }
}

// 嵌入 YouTube(iframe)或 Instagram(官方 embed.js,公開貼文免 token)。
export default function MediaEmbed({ url }: { url?: string | null }) {
  const yt = url ? ytId(url) : null;
  const tt = url ? ttId(url) : null;
  const ig = url ? isIg(url) : false;

  useEffect(() => {
    if (!ig) return;
    const run = () => window.instgrm?.Embeds?.process();
    if (window.instgrm) { run(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.instagram.com/embed.js"]');
    if (existing) { existing.addEventListener("load", run); return; }
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = run;
    document.body.appendChild(s);
  }, [ig, url]);

  if (!url) return null;
  if (yt) {
    return (
      <div className="media-embed yt">
        <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="影片介紹"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  if (tt) {
    return (
      <div className="media-embed tt">
        <iframe src={`https://www.tiktok.com/embed/v2/${tt}`} title="TikTok 影片" allow="encrypted-media; fullscreen" allowFullScreen />
      </div>
    );
  }
  if (ig) {
    return (
      <div className="media-embed ig">
        <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" style={{ margin: 0, maxWidth: "100%", width: "100%" }}>
          <a href={url} target="_blank" rel="noopener noreferrer">在 Instagram 查看</a>
        </blockquote>
      </div>
    );
  }
  return <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">觀看影片 ↗</a>;
}
