"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo({ href = "/", src, size }: { href?: string; src?: string; size?: number }) {
  const pathname = usePathname();

  function onClick(e: React.MouseEvent) {
    // 已經在同一頁時,點 LOGO 平滑捲回最頂(不重新導航)
    if (pathname === href) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <Link href={href} className="brand" aria-label="偶宿 O!" onClick={onClick}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="brand-logo" src={src} alt="偶宿 O!" style={size ? { height: size, maxHeight: size } : undefined} />
      ) : (
        <>
          <svg className="mk" viewBox="0 0 46 40" fill="none" aria-hidden>
            <circle cx="15" cy="15" r="10.5" stroke="currentColor" strokeWidth="4" />
            <path d="M15 30.5 L10.5 23.5 a10.5 10.5 0 0 0 9 0 Z" fill="currentColor" />
            <rect x="33.5" y="4.5" width="5" height="16.5" rx="2.5" fill="currentColor" />
            <circle cx="36" cy="28" r="3" fill="#e5fa00" />
          </svg>
          <span className="wm">
            <b>偶宿</b>
            <span>台灣民宿搜尋</span>
          </span>
        </>
      )}
    </Link>
  );
}
