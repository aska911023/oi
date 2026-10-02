"use client";

export default function ShareLinkButton({ path, label = "分享" }: { path: string; label?: string }) {
  async function share(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    const data = { title: "偶宿 O! 行程", url };
    // 優先用系統分享(手機),否則複製連結
    if (navigator.share) { try { await navigator.share(data); return; } catch { /* 取消 */ return; } }
    try { await navigator.clipboard.writeText(url); alert("連結已複製:\n" + url); }
    catch { prompt("複製這個連結分享:", url); }
  }
  return <button className="trip-share" onClick={share} title="分享">↗ {label}</button>;
}
