import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="偶宿 O!">
      <svg className="mk" viewBox="0 0 40 40" fill="none" aria-hidden>
        <rect width="40" height="40" rx="12" fill="#17635a" />
        <path
          d="M20 9c-4.1 0-7.2 3.1-7.2 7.2 0 5 7.2 11.2 7.2 11.2s7.2-6.2 7.2-11.2C27.2 12.1 24.1 9 20 9z"
          fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinejoin="round"
        />
        <circle cx="20" cy="16.2" r="2.4" fill="#e5fa00" />
      </svg>
      <span className="wm">
        <b>偶宿</b>
        <span>台灣民宿搜尋</span>
      </span>
    </Link>
  );
}
