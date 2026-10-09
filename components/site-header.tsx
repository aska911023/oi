import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import MobileMenu from "@/components/mobile-menu";
import DestinationsNav from "@/components/destinations-nav";
import NotificationBell from "@/components/notification-bell";
import Avatar from "@/components/avatar";
import type { Viewer } from "@/lib/viewer";

export default async function SiteHeader({ viewer, onGreen = false }: { viewer: Viewer; onGreen?: boolean }) {
  const settings = await getSiteSettings();
  const { loggedIn, role, name, avatarUrl } = viewer;

  return (
    <header className={"topbar " + (onGreen ? "on-green" : "solid")}>
      <div className="shell">
        <Logo src={settings.logo_image || undefined} size={settings.logo_size} />
        <nav className="topnav">
          <DestinationsNav />
          <Link href="/places/attraction">探索景點</Link>
          <Link href="/plan">規劃行程</Link>
          <Link href="/trips">行程分享</Link>
          <Link href="/contact">聯絡我們</Link>
          <Link href="/search" className="topnav-search" aria-label="搜尋" title="搜尋">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          </Link>
          {loggedIn ? (
            <>
              {role === "admin" && <Link href="/admin">管理後台</Link>}
              {(role === "partner" || role === "admin") && <Link href="/vendor">業者後台</Link>}
              <NotificationBell />
              <Link href="/me/trips" className="cta cta-user"><Avatar src={avatarUrl} name={name} size={30} /> 歡迎,{name}</Link>
            </>
          ) : (
            <Link href="/login" className="cta">登入 / 註冊</Link>
          )}
        </nav>
        <MobileMenu loggedIn={loggedIn} name={name} avatarUrl={avatarUrl} isAdmin={role === "admin"} isPartner={role === "partner" || role === "admin"} />
      </div>
    </header>
  );
}
