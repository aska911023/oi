import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import MobileMenu from "@/components/mobile-menu";
import NotificationBell from "@/components/notification-bell";

export default async function SiteHeader({ onGreen = false }: { onGreen?: boolean }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const settings = await getSiteSettings();

  let name = "";
  let role = "user";
  if (user) {
    const { data } = await sb.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle();
    name = data?.display_name || user.email?.split("@")[0] || "";
    role = data?.role || "user";
  }

  return (
    <header className={"topbar " + (onGreen ? "on-green" : "solid")}>
      <div className="shell">
        <Logo src={settings.logo_image || undefined} size={settings.logo_size} />
        <nav className="topnav">
          <Link href="/places/attraction">探索景點</Link>
          <Link href="/plan">規劃行程</Link>
          <Link href="/trips">行程分享</Link>
          {user ? (
            <>
              {role === "admin" && <Link href="/admin">管理後台</Link>}
              <NotificationBell />
              <Link href="/me/trips" className="cta">歡迎,{name}</Link>
            </>
          ) : (
            <Link href="/login" className="cta">登入 / 註冊</Link>
          )}
        </nav>
        <MobileMenu loggedIn={!!user} name={name} isAdmin={role === "admin"} />
      </div>
    </header>
  );
}
