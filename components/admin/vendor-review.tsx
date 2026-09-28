"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface App {
  id: string;
  applicant_id: string;
  business_name: string;
  note: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = { pending: "待審核", approved: "已通過", rejected: "已婉拒" };

export default function VendorReview({ initial }: { initial: App[] }) {
  const [list, setList] = useState<App[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const sb = createClient();
    const { data } = await sb.from("vendor_applications").select("*").order("created_at", { ascending: false });
    setList((data as App[]) || []);
  }

  async function approve(a: App) {
    setBusy(a.id);
    const sb = createClient();
    await sb.from("vendor_applications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    await sb.from("vendors").upsert({ owner_id: a.applicant_id, business_name: a.business_name }, { onConflict: "owner_id" });
    await sb.from("profiles").update({ role: "partner" }).eq("id", a.applicant_id);
    setBusy(null);
    await refresh();
  }
  async function reject(a: App) {
    setBusy(a.id);
    const sb = createClient();
    await sb.from("vendor_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    setBusy(null);
    await refresh();
  }

  const pending = list.filter((a) => a.status === "pending").length;

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{list.length}</div><div className="l">總申請</div></div>
        <div className="stat-card"><div className="n">{pending}</div><div className="l">待審核</div></div>
        <div className="stat-card"><div className="n">{list.filter((a) => a.status === "approved").length}</div><div className="l">已通過</div></div>
        <div className="stat-card"><div className="n">{list.filter((a) => a.status === "rejected").length}</div><div className="l">已婉拒</div></div>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr><th>商家名稱</th><th>備註</th><th>狀態</th><th>申請日期</th><th>操作</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="empty-row">目前沒有業者申請。</td></tr>}
            {list.map((a) => (
              <tr key={a.id}>
                <td><b>{a.business_name}</b></td>
                <td>{a.note || "—"}</td>
                <td><span className={"pill " + a.status}>{STATUS_LABEL[a.status]}</span></td>
                <td>{new Date(a.created_at).toLocaleDateString("zh-TW")}</td>
                <td>
                  {a.status === "pending" ? (
                    <div className="row-actions">
                      <button className="lnk" onClick={() => approve(a)} disabled={busy === a.id}>通過</button>
                      <button className="lnk danger" onClick={() => reject(a)} disabled={busy === a.id}>婉拒</button>
                    </div>
                  ) : <span style={{ color: "var(--muted)", fontSize: 13 }}>已處理</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
