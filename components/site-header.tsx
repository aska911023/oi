import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import MobileMenu from "@/components/mobile-menu";
import DestinationsNav from "@/components/destinations-nav";
import HeaderSearch from "@/components/header-search";
import HeaderAuth from "@/components/header-auth";

// 殼層 header:logo / 搜尋 / 導覽維持伺服器端靜態(利於 CDN 快取);
// 「登入狀態」區塊(業者/管理/通知/頭貼 或 登入鈕)交給 client 的 <HeaderAuth />,
// 所以本元件與 (site)/layout 不必查 auth,內容頁才能進 ISR。
export default async function SiteHeader({ onGreen = false }: { onGreen?: boolean }) {
  const settings = await getSiteSettings();

  return (
    <header className={"topbar " + (onGreen ? "on-green" : "solid")}>
      <div className="shell">
        <Logo src={settings.logo_image || undefined} size={settings.logo_size} />
        <nav className="topnav">
          <HeaderSearch />
          <DestinationsNav />
          <Link href="/places/attraction">探索景點</Link>
          <Link href="/plan">規劃行程</Link>
          <Link href="/trips">行程分享</Link>
          <Link href="/contact">聯絡我們</Link>
          <HeaderAuth />
        </nav>
        <MobileMenu />
      </div>
    </header>
  );
}
