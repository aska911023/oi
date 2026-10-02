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
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" /></svg>
    </button>
  );
}
