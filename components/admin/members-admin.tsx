"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Member {
  id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  created_at: string | null;
  email: string;
}

const ROLE_LABEL: Record<string, string> = { user: "會員", partner: "業者", admin: "管理員" };

export default function MembersAdmin({ initial }: { initial: Member[] }) {
  const [rows, setRows] = useState<Member[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function changeRole(m: Member, role: string) {
    if (role === m.role) return;
    if (role === "admin" && !confirm(`確定將「${m.display_name || m.email}」設為管理員?管理員可存取整個後台。`)) return;
    setBusy(m.id);
    const sb = createClient();
    const { error } = await sb.from("profiles").update({ role }).eq("id", m.id);
    // 升級為業者時,建立業者資料(若尚無)
    if (!error && role === "partner") {
      await sb.from("vendors").upsert({ owner_id: m.id, business_name: m.display_name || m.full_name || "業者" }, { onConflict: "owner_id" });
    }
    setBusy(null);
    if (error) { alert("更新失敗:" + error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === m.id ? { ...r, role } : r)));
  }

  const count = (r: string) => rows.filter((x) => x.role === r).length;

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{rows.length}</div><div className="l">總會員</div></div>
        <div className="stat-card"><div className="n">{count("partner")}</div><div className="l">業者</div></div>
        <div className="stat-card"><div className="n">{count("admin")}</div><div className="l">管理員</div></div>
        <div className="stat-card"><div className="n">{count("user")}</div><div className="l">一般會員</div></div>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr><th>暱稱</th><th>姓名</th><th>手機</th><th>通訊地址</th><th>Email</th><th>身分</th><th>加入日期</th><th>設定身分</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty-row">尚無會員。</td></tr>}
            {rows.map((m) => (
              <tr key={m.id}>
                <td><b>{m.display_name || "—"}</b></td>
                <td>{m.full_name || "—"}</td>
                <td>{m.phone || "—"}</td>
                <td>{m.address || "—"}</td>
                <td>{m.email || "—"}</td>
                <td><span className={"pill role-" + m.role}>{ROLE_LABEL[m.role]}</span></td>
                <td>{m.created_at ? new Date(m.created_at).toLocaleDateString("zh-TW") : "—"}</td>
                <td>
                  <select
                    className="role-select"
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={(e) => changeRole(m, e.target.value)}
                  >
                    <option value="user">會員</option>
                    <option value="partner">業者</option>
                    <option value="admin">管理員</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14 }}>將會員設為「業者」後,對方即可上架自己的民宿;「管理員」可存取整個後台,請謹慎授予。</p>
    </>
  );
}
