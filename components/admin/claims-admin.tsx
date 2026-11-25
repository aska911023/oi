"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Claim {
  id: string; kind: string; target_id: string; target_name: string; applicant_id: string;
  applicant_role: string; auth_until: string | null; contact: string; relation_note: string;
  wish_note: string; material_note: string; want_paid: boolean; status: string; admin_note: string; created_at: string;
}
export interface Applicant { id: string; name: string }

const STATUS: Record<string, { label: string; pill: string }> = {
  pending: { label: "待驗證", pill: "pending" }, verifying: { label: "審核中", pill: "pending" },
  need_docs: { label: "待補件", pill: "draft" }, approved: { label: "已通過", pill: "live" }, rejected: { label: "未通過", pill: "draft" },
};
const KIND_LABEL: Record<string, string> = { stay: "民宿", restaurant: "餐廳", activity: "娛樂", catering: "外燴", attraction: "景點", parking: "停車", rental: "租車", happening: "活動" };
const ROLE_LABEL: Record<string, string> = { owner: "負責人", manager: "管理者", agent: "代理/代管", employee: "員工/窗口" };

export default function ClaimsAdmin({ initial, applicants }: { initial: Claim[]; applicants: Applicant[] }) {
  const [list, setList] = useState<Claim[]>(initial);
  const [tab, setTab] = useState<"open" | "all">("open");
  const nameOf = useMemo(() => Object.fromEntries(applicants.map((a) => [a.id, a.name])), [applicants]);
  const filtered = useMemo(() => tab === "open" ? list.filter((c) => ["pending", "verifying", "need_docs"].includes(c.status)) : list, [list, tab]);
  const pendingN = list.filter((c) => c.status === "pending").length;

  async function refresh() {
    const { data } = await createClient().from("claims").select("*").order("created_at", { ascending: false });
    setList((data as Claim[]) || []);
  }
  async function approve(c: Claim) {
    if (!confirm(`核准後會把「${c.target_name}」的管理權指派給此申請人(並升為業者)。確定?`)) return;
    const { error } = await createClient().rpc("claim_approve", { p_claim: c.id });
    if (error) { alert("核准失敗:" + error.message); return; }
    await refresh();
  }
  async function setStatus(c: Claim, status: string) {
    const note = status === "rejected" || status === "need_docs" ? (prompt(status === "rejected" ? "未通過原因:" : "需補哪些資料?") ?? "") : c.admin_note;
    await createClient().from("claims").update({ status, admin_note: note }).eq("id", c.id);
    await refresh();
  }
  async function remove(c: Claim) {
    if (!confirm("刪除這筆認領申請?")) return;
    await createClient().from("claims").delete().eq("id", c.id);
    await refresh();
  }
  const detailHref = (c: Claim) => c.kind === "stay" ? `/stay/${c.target_id}` : c.kind === "happening" ? `/events` : "#";

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n" style={{ color: pendingN ? "var(--accent-orange,#b4690e)" : undefined }}>{pendingN}</div><div className="l">待處理</div></div>
        <div className="stat-card"><div className="n">{list.filter((c) => c.status === "approved").length}</div><div className="l">已通過</div></div>
        <div className="stat-card"><div className="n">{list.length}</div><div className="l">全部</div></div>
      </div>
      <div className="admin-bar">
        <div className="seg">
          <button className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>待處理</button>
          <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>全部</button>
        </div>
        <div style={{ flex: 1, fontSize: 13, color: "var(--muted)" }}>核准即把管理權指派給申請人。請先以其提供的官方聯繫獨立核對授權,再核准。</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && <div className="empty">目前沒有認領申請。</div>}
        {filtered.map((c) => {
          const st = STATUS[c.status] || { label: c.status, pill: "draft" };
          return (
            <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="pill feat">{KIND_LABEL[c.kind] || c.kind}</span>
                <b style={{ fontSize: 16 }}>{c.target_name}</b>
                {detailHref(c) !== "#" && <a className="lnk" href={detailHref(c)} target="_blank" rel="noopener noreferrer">看頁面 ↗</a>}
                <span className={"pill " + st.pill} style={{ marginLeft: "auto" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.9 }}>
                <div>申請人:<b>{nameOf[c.applicant_id] || c.applicant_id.slice(0, 8)}</b>　角色:{ROLE_LABEL[c.applicant_role] || c.applicant_role}{c.auth_until ? `　授權至 ${c.auth_until}` : ""}</div>
                <div>可核對聯繫:<b>{c.contact || "—"}</b></div>
                {c.relation_note && <div>關係:{c.relation_note}</div>}
                {c.wish_note && <div>希望更正:{c.wish_note}</div>}
                {c.material_note && <div>素材授權:{c.material_note}</div>}
                {c.want_paid && <div style={{ color: "var(--accent-orange,#b4690e)" }}>💬 另想了解付費合作</div>}
                {c.admin_note && <div style={{ color: "var(--muted)" }}>內部備註:{c.admin_note}</div>}
              </div>
              <div className="row-actions" style={{ marginTop: 10 }}>
                {c.status !== "approved" && <button className="btn btn-primary btn-sm" onClick={() => approve(c)}>核准並指派管理權</button>}
                {c.status !== "verifying" && c.status !== "approved" && <button className="lnk" onClick={() => setStatus(c, "verifying")}>標記審核中</button>}
                {c.status !== "need_docs" && <button className="lnk" onClick={() => setStatus(c, "need_docs")}>需補件</button>}
                {c.status !== "rejected" && <button className="lnk danger" onClick={() => setStatus(c, "rejected")}>退回</button>}
                <button className="lnk danger" onClick={() => remove(c)}>刪除</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
