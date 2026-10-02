"use client";

export default function ShareLinkButton({ path }: { path: string; label?: string }) {
  async function share(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    const data = { title: "偶宿 O! 行程", url };
    if (navigator.share) { try { await navigator.share(data); return; } catch { return; } }
    try { await navigator.clipboard.writeText(url); alert("連結已複製:\n" + url); }
    catch { prompt("複製這個連結分享:", url); }
  }
  return (
    <button className="trip-act" onClick={share} title="分享" aria-label="分享">
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
    </button>
  );
}
