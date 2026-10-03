"use client";

// 分享景點/美食/停車:用系統分享或複製(名稱 + 地圖連結)。
export default function SharePlaceButton({ name, mapUrl }: { name: string; mapUrl: string }) {
  async function share(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const data = { title: name, text: name, url: mapUrl };
    if (navigator.share) { try { await navigator.share(data); return; } catch { return; } }
    try { await navigator.clipboard.writeText(`${name}\n${mapUrl}`); alert("已複製分享內容:\n" + name); }
    catch { prompt("複製分享:", `${name} ${mapUrl}`); }
  }
  return (
    <button className="btn btn-ghost" onClick={share} aria-label="分享">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "-3px" }}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" /></svg>
      分享
    </button>
  );
}
