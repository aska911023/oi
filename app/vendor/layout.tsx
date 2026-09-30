import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import SiteTheme from "@/components/site-theme";
import VendorTabs from "@/components/vendor/vendor-tabs";

export const dynamic = "force-dynamic";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor");

  const { data: profile } = await sb.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
  const role = profile?.role;
  if (role !== "partner" && role !== "admin") redirect("/apply"); // 還不是業者 → 去申請

  const settings = await getSiteSettings();

  return (
    <>
      <SiteTheme s={settings} />
      <header className="topbar solid">
        <div className="shell">
          <Logo href="/vendor" src={settings.logo_image || undefined} size={settings.logo_size} />
          <nav className="topnav">
            <Link href="/">看前台</Link>
            {role === "admin" && <Link href="/admin">總後台</Link>}
            <Link href="/account">我的帳號</Link>
          </nav>
        </div>
      </header>
      <div className="admin-shell">
        <div className="admin-head">
          <h1>業者後台</h1>
          <p>管理你自己的商品。上架後由偶宿審核發布;價格與剩餘數以你設定的房型 / 方案為準。</p>
        </div>
        <VendorTabs />
        {children}
      </div>
    </>
  );
}
