import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import SiteTheme from "@/components/site-theme";
import VendorTabs from "@/components/vendor/vendor-tabs";
import RoleViewSwitcher from "@/components/role-view-switcher";
import type { ViewRole } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor");

  let { data: profile } = await sb.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();

  // 設定的 admin email 自動升級(直接進 /vendor 也生效,跟 /admin 一致,否則其他管理員會被踢到 /apply)
  const adminEmails = (process.env.OUSU_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (user.email && adminEmails.includes(user.email.toLowerCase()) && profile?.role !== "admin" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await createAdminClient().from("profiles").update({ role: "admin" }).eq("id", user.id);
      const { data: p2 } = await sb.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
      profile = p2;
    } catch { /* 升級失敗就照原 role 把關 */ }
  }

  const role = profile?.role;
  if (role !== "partner" && role !== "admin") redirect("/apply"); // 還不是業者 → 去申請(存取用真實身分)

  // 「總後台」連結用「有效身分」(admin 若正在以業者等身分預覽,就跟著藏起來)
  const rawView = role === "admin" ? (await cookies()).get("oi_view_as")?.value : undefined;
  const viewAs = (["partner", "user", "guest"].includes(rawView || "") ? rawView : null) as ViewRole | null;
  const effRole = viewAs || role;

  const settings = await getSiteSettings();

  return (
    <>
      <SiteTheme s={settings} />
      <RoleViewSwitcher isRealAdmin={role === "admin"} viewAs={viewAs} compact />
      <header className="topbar solid">
        <div className="shell">
          <Logo href="/vendor" src={settings.logo_image || undefined} size={settings.logo_size} />
          <nav className="topnav">
            <Link href="/">看前台</Link>
            {effRole === "admin" && <Link href="/admin">總後台</Link>}
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
