import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="偶宿 O!">
      <svg className="mk" viewBox="0 0 46 40" fill="none" aria-hidden>
        {/* O = 定位(圓環 + 向下收尖的圖釘) */}
        <circle cx="15" cy="15" r="10.5" stroke="currentColor" strokeWidth="4" />
        <path d="M15 30.5 L10.5 23.5 a10.5 10.5 0 0 0 9 0 Z" fill="currentColor" />
        {/* ! = 發現(圓角筆畫 + 圓點) */}
        <rect x="33.5" y="4.5" width="5" height="16.5" rx="2.5" fill="currentColor" />
        <circle cx="36" cy="28" r="3" fill="#e5fa00" />
      </svg>
      <span className="wm">
        <b>偶宿</b>
        <span>台灣民宿搜尋</span>
      </span>
    </Link>
  );
}
