import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { user: "會員", partner: "業者", admin: "管理員" };

export default async function Members() {
  const sb = await createClient();
  const { data: profiles } = await sb.from("profiles").select("*").order("created_at", { ascending: false });

  const emailById: Record<string, string> = {};
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      data.users.forEach((u) => { emailById[u.id] = u.email || ""; });
    }
  } catch {}

  const rows = profiles || [];

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{rows.length}</div><div className="l">總會員</div></div>
        <div className="stat-card"><div className="n">{rows.filter((r) => r.role === "partner").length}</div><div className="l">業者</div></div>
        <div className="stat-card"><div className="n">{rows.filter((r) => r.role === "admin").length}</div><div className="l">管理員</div></div>
        <div className="stat-card"><div className="n">{rows.filter((r) => r.role === "user").length}</div><div className="l">一般會員</div></div>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr><th>暱稱</th><th>姓名</th><th>手機</th><th>通訊地址</th><th>Email</th><th>身分</th><th>加入日期</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty-row">尚無會員。</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.display_name || "—"}</b></td>
                <td>{r.full_name || "—"}</td>
                <td>{r.phone || "—"}</td>
                <td>{r.address || "—"}</td>
                <td>{emailById[r.id] || "—"}</td>
                <td><span className={"pill role-" + (r.role || "user")}>{ROLE_LABEL[r.role || "user"]}</span></td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleDateString("zh-TW") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
