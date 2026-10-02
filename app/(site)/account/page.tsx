import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/signout-button";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { user: "會員", partner: "業者", admin: "管理員" };

export default async function Account() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();

  // 自動升級 admin(email 設定在 OUSU_ADMIN_EMAILS)
  const admins = (process.env.OUSU_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (user.email && admins.includes(user.email.toLowerCase()) && profile?.role !== "admin" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await createAdminClient().from("profiles").update({ role: "admin" }).eq("id", user.id);
      const { data: p2 } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (p2) profile = p2;
    } catch {}
  }

  const role = profile?.role || "user";
  const created = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("zh-TW") : "—";

  return (
      <div className="account">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1>我的帳號</h1>
          <span className="role-badge">{ROLE_LABEL[role]}</span>
        </div>

        <div className="account-card">
          <dl style={{ margin: 0 }}>
            <div className="account-row"><dt>暱稱</dt><dd>{profile?.display_name || "—"}</dd></div>
            <div className="account-row"><dt>姓名</dt><dd>{profile?.full_name || "—"}</dd></div>
            <div className="account-row"><dt>手機</dt><dd>{profile?.phone || "—"}</dd></div>
            <div className="account-row"><dt>通訊地址</dt><dd>{profile?.address || "—"}</dd></div>
            <div className="account-row"><dt>Email</dt><dd>{user.email}</dd></div>
            <div className="account-row"><dt>加入日期</dt><dd>{created}</dd></div>
          </dl>
        </div>

        <div className="account-actions">
          <Link href="/me/trips" className="btn btn-primary">我的行程</Link>
          <Link href="/me/saved" className="btn btn-ghost">我的收藏</Link>
          <Link href="/" className="btn btn-ghost">繼續探索民宿</Link>
          {role === "user" && <Link href="/apply" className="btn btn-ghost">申請成為業者</Link>}
          {(role === "partner" || role === "admin") && <Link href="/vendor" className="btn btn-ghost">業者後台</Link>}
          {role === "admin" && <Link href="/admin" className="btn btn-ghost">管理後台</Link>}
          <span className="signout-right"><SignOutButton /></span>
        </div>
      </div>
  );
}
