"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface App {
  id: string;
  applicant_id: string;
  business_name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  line_url?: string | null;
  fb_url?: string | null;
  ig_url?: string | null;
  license_url?: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = { pending: "待審核", approved: "已通過", rejected: "已婉拒" };

export default function VendorReview({ initial }: { initial: App[] }) {
  const [list, setList] = useState<App[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<App | null>(null);

  async function refresh() {
    const sb = createClient();
    const { data } = await sb.from("vendor_applications").select("*").order("created_at", { ascending: false });
    setList((data as App[]) || []);
  }

  async function openLicense(path: string) {
    const sb = createClient();
    const { data, error } = await sb.storage.from("vendor-docs").createSignedUrl(path, 300);
    if (error || !data) { alert("無法開啟檔案:" + (error?.message || "未知錯誤")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function approve(a: App) {
    setBusy(a.id);
    const sb = createClient();
    await sb.from("vendor_applications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    await sb.from("vendors").upsert({
      owner_id: a.applicant_id, business_name: a.business_name,
      phone: a.phone || null, address: a.address || null, email: a.email || null,
      website: a.website || null, line_url: a.line_url || null, fb_url: a.fb_url || null, ig_url: a.ig_url || null, license_url: a.license_url || null,
    }, { onConflict: "owner_id" });
    await sb.from("profiles").update({ role: "partner" }).eq("id", a.applicant_id);
    setBusy(null);
    setView(null);
    await refresh();
  }
  async function reject(a: App) {
    setBusy(a.id);
    const sb = createClient();
    await sb.from("vendor_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    setBusy(null);
    setView(null);
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
            <tr><th>商家名稱</th><th>電話</th><th>執照</th><th>狀態</th><th>申請日期</th><th>操作</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="empty-row">目前沒有業者申請。</td></tr>}
            {list.map((a) => (
              <tr key={a.id}>
                <td><b>{a.business_name}</b></td>
                <td>{a.phone || "—"}</td>
                <td>{a.license_url ? <button className="lnk" onClick={() => openLicense(a.license_url!)}>檢視</button> : <span style={{ color: "var(--muted)" }}>未附</span>}</td>
                <td><span className={"pill " + a.status}>{STATUS_LABEL[a.status]}</span></td>
                <td>{new Date(a.created_at).toLocaleDateString("zh-TW")}</td>
                <td>
                  <div className="row-actions">
                    <button className="lnk" onClick={() => setView(a)}>詳情</button>
                    {a.status === "pending" && (
                      <>
                        <button className="lnk" onClick={() => approve(a)} disabled={busy === a.id}>通過</button>
                        <button className="lnk danger" onClick={() => reject(a)} disabled={busy === a.id}>婉拒</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view && (
        <>
          <div className="overlay" onClick={() => setView(null)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{view.business_name}</h2>
            <dl className="kv">
              <div><dt>地址</dt><dd>{view.address || "—"}</dd></div>
              <div><dt>電話</dt><dd>{view.phone || "—"}</dd></div>
              <div><dt>Email</dt><dd>{view.email || "—"}</dd></div>
              <div><dt>官網</dt><dd>{view.website ? <a href={view.website} target="_blank" rel="noopener noreferrer">{view.website}</a> : "—"}</dd></div>
              <div><dt>官方 LINE</dt><dd>{view.line_url || "—"}</dd></div>
              <div><dt>官方 FB</dt><dd>{view.fb_url ? <a href={view.fb_url} target="_blank" rel="noopener noreferrer">{view.fb_url}</a> : "—"}</dd></div>
              <div><dt>官方 IG</dt><dd>{view.ig_url ? <a href={view.ig_url} target="_blank" rel="noopener noreferrer">{view.ig_url}</a> : "—"}</dd></div>
              <div><dt>營業執照</dt><dd>{view.license_url ? <button className="lnk" onClick={() => openLicense(view.license_url!)}>開啟檔案(新分頁)</button> : "未附"}</dd></div>
              <div><dt>備註</dt><dd>{view.note || "—"}</dd></div>
            </dl>
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setView(null)}>關閉</button>
              {view.status === "pending" && (
                <>
                  <button className="btn btn-ghost danger" onClick={() => reject(view)} disabled={busy === view.id}>婉拒</button>
                  <button className="btn btn-primary" onClick={() => approve(view)} disabled={busy === view.id}>通過並開通業者</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
