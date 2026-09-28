import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import AdminTabs from "@/components/admin/admin-tabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();

  // 設定的 admin email 自動升級(方便第一次進後台)
  const admins = (process.env.OUSU_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (user.email && admins.includes(user.email.toLowerCase()) && profile?.role !== "admin" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await createAdminClient().from("profiles").update({ role: "admin" }).eq("id", user.id);
      const { data: p2 } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
      profile = p2; // 以資料庫真實 role 把關(升級若被擋則不放行)
    } catch {}
  }

  if (profile?.role !== "admin") redirect("/");

  const settings = await getSiteSettings();

  return (
    <>
      <header className="topbar solid">
        <div className="shell">
          <Logo href="/admin" src={settings.logo_image || undefined} />
          <nav className="topnav">
            <Link href="/">看前台</Link>
            <Link href="/account">我的帳號</Link>
          </nav>
        </div>
      </header>
      <div className="admin-shell">
        <div className="admin-head">
          <h1>偶宿營運後台</h1>
          <p>管理民宿、會員、業者與數據。</p>
        </div>
        <AdminTabs />
        {children}
      </div>
    </>
  );
}
