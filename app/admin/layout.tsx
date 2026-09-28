import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
      profile = { role: "admin" };
    } catch {}
  }

  if (profile?.role !== "admin") redirect("/");

  return (
    <>
      <header className="topbar solid">
        <div className="shell">
          <Logo href="/admin" />
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
