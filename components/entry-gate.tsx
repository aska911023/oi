"use client";

import { useEffect, useState } from "react";

// 進站前的確認閘門(每個瀏覽器 session 按一次):擋掉大部分不跑 JS 的爬蟲。
export default function EntryGate({ logoSrc }: { logoSrc?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { if (!sessionStorage.getItem("oi_entered")) setShow(true); }
    catch { setShow(true); }
  }, []);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [show]);

  if (!show) return null;

  const enter = () => {
    try { sessionStorage.setItem("oi_entered", "1"); } catch { /* 無痕模式略過 */ }
    setShow(false);
  };

  return (
    <div className="entrygate" role="dialog" aria-modal="true" aria-label="進入偶宿 O!">
      <div className="entrygate-card">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="eg-logo" src={logoSrc} alt="偶宿 O!" />
        ) : (
          <div className="eg-mark" aria-hidden>
            <svg viewBox="0 0 46 40" fill="none" width="56" height="48">
              <circle cx="15" cy="15" r="10.5" stroke="var(--green)" strokeWidth="4" />
              <path d="M15 30.5 L10.5 23.5 a10.5 10.5 0 0 0 9 0 Z" fill="var(--green)" />
              <rect x="33.5" y="4.5" width="5" height="16.5" rx="2.5" fill="var(--green)" />
              <circle cx="36" cy="28" r="3" fill="var(--yellow)" />
            </svg>
          </div>
        )}
        <h2>偶宿 O!</h2>
        <p className="eg-sub">偶爾出走 | 找到你喜歡的住宿方式。</p>
        <p className="eg-note">為確認您是真人訪客,請點擊下方按鈕進入。</p>
        <button className="btn btn-primary eg-btn" onClick={enter} autoFocus>進入網站</button>
      </div>
    </div>
  );
}
