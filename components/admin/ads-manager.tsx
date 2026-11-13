"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import type { Plan } from "@/components/admin/plans-editor";

export interface Ad {
  id: string; owner_id: string | null; title: string; image: string; link_url: string | null;
  region: string; tier: string; start_date: string | null; end_date: string | null;
  status: string; reject_reason: string | null; sort: number;
}
const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const STATUS: Record<string, { label: string; pill: string }> = {
  pending: { label: "待審核", pill: "pending" }, approved: { label: "已核准", pill: "live" }, rejected: { label: "未通過", pill: "draft" },
};
type Form = Partial<Ad> & { images?: string[] };

export default function AdsManager({ initial, mode, ownerId, plans = [] }: {
  initial: Ad[]; mode: "admin" | "vendor"; ownerId?: string; plans?: Plan[];
}) {
  const isAdmin = mode === "admin";
  const [list, setList] = useState<Ad[]>(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const planOptions = plans.length ? plans : [{ key: "free", name: "免費方案", room_pins: 0, priority: 0, sort: 0 }];
  const tierName = (k: string) => planOptions.find((p) => p.key === k)?.name || k;

  const stats = useMemo(() => ({
    pending: list.filter((a) => a.status === "pending").length,
    approved: list.filter((a) => a.status === "approved").length,
  }), [list]);

  async function refresh() {
    const sb = createClient();
    let q = sb.from("ad_campaigns").select("*").order("created_at", { ascending: false });
    if (ownerId) q = q.eq("owner_id", ownerId);
    const { data } = await q;
    setList((data as Ad[]) || []);
  }

  async function save() {
    if (!form) return;
    if (!form.title?.trim()) { alert("請填標題"); return; }
    const image = form.images?.[0] || form.image || "";
    if (!image) { alert("請上傳廣告圖"); return; }
    setBusy(true);
    const sb = createClient();
    const payload = {
      title: form.title.trim(), image, link_url: form.link_url?.trim() || null,
      region: form.region || "all", tier: form.tier || "free",
      start_date: form.start_date || null, end_date: form.end_date || null,
      ...(isAdmin ? { status: form.status || "pending", sort: Number(form.sort) || 0 } : {}),
      ...(ownerId && !form.id ? { owner_id: ownerId } : {}),
    };
    let error;
    if (form.id) ({ error } = await sb.from("ad_campaigns").update(payload).eq("id", form.id));
    else ({ error } = await sb.from("ad_campaigns").insert(payload));
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setForm(null);
    await refresh();
  }

  async function setStatus(a: Ad, status: string, reason?: string) {
    const sb = createClient();
    await sb.from("ad_campaigns").update({ status, reject_reason: reason ?? null }).eq("id", a.id);
    if (status === "approved" && a.owner_id) {
      await sb.from("notifications").insert({ user_id: a.owner_id, kind: "ad_approved", title: `你的活動廣告「${a.title}」已通過審核並上線 🎉`, href: "/vendor/ads" });
    }
    await refresh();
  }
  const doApprove = (a: Ad) => setStatus(a, "approved");
  const doReject = (a: Ad) => { const r = prompt("未通過原因(會顯示給業者):") ?? ""; setStatus(a, "rejected", r); };

  async function remove(a: Ad) {
    if (!confirm(`確定刪除廣告「${a.title}」?`)) return;
    await createClient().from("ad_campaigns").delete().eq("id", a.id);
    await refresh();
  }

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n" style={{ color: stats.pending ? "var(--accent-orange,#b4690e)" : undefined }}>{stats.pending}</div><div className="l">待審核</div></div>
        <div className="stat-card"><div className="n">{stats.approved}</div><div className="l">已上線</div></div>
        <div className="stat-card"><div className="n">{list.length}</div><div className="l">全部</div></div>
      </div>

      <div className="admin-bar">
        <div style={{ flex: 1, fontSize: 13.5, color: "var(--muted)" }}>
          {isAdmin ? "審核業者投放的活動廣告;核准後會在該地區的民宿 / 景點詳情頁中間輪播。" : "上傳活動廣告,送審核通過後會在你選的地區詳情頁中間輪播曝光。"}
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ region: "all", tier: "free" })}>＋ 新增廣告</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th></th><th>標題</th><th>地區</th><th>方案</th><th>檔期</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="empty-row">還沒有廣告,點右上「新增廣告」開始。</td></tr>}
            {list.map((a) => {
              const st = STATUS[a.status] || { label: a.status, pill: "draft" };
              return (
                <tr key={a.id}>
                  <td>{a.image ? <img className="athumb" src={a.image} alt="" /> : <div className="athumb" />}</td>
                  <td><b>{a.title}</b>{a.link_url && <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.link_url}</div>}</td>
                  <td>{a.region === "all" ? "全站" : a.region}</td>
                  <td>{tierName(a.tier)}</td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{a.start_date || "—"} ~ {a.end_date || "不限"}</td>
                  <td><span className={"pill " + st.pill}>{st.label}</span>{a.status === "rejected" && a.reject_reason && <div style={{ fontSize: 11, color: "var(--accent-red,#c0392b)" }}>{a.reject_reason}</div>}</td>
                  <td>
                    <div className="row-actions">
                      {isAdmin && a.status !== "approved" && <button className="lnk" onClick={() => doApprove(a)}>核准</button>}
                      {isAdmin && a.status !== "rejected" && <button className="lnk danger" onClick={() => doReject(a)}>退回</button>}
                      <button className="lnk" onClick={() => setForm({ ...a, images: a.image ? [a.image] : [] })}>編輯</button>
                      <button className="lnk danger" onClick={() => remove(a)}>刪除</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <>
          <div className="overlay" onClick={() => setForm(null)} />
          <div className="editor" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
            <h2>{form.id ? "編輯" : "新增"}活動廣告</h2>
            {!isAdmin && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>送出後需經平台審核,通過才會上線曝光。</p>}
            <div className="form-grid">
              <div className="wide"><label>標題 *</label><input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="活動 / 廣告標題" /></div>
              <div className="wide"><label>廣告圖 *(建議寬幅,約 4:1)</label>
                <MultiImageUploader prefix="ad" value={form.images && form.images.length ? form.images : (form.image ? [form.image] : [])}
                  onChange={(imgs) => setForm((f) => (f ? { ...f, images: imgs, image: imgs[0] || "" } : f))} />
              </div>
              <div className="wide"><label>點擊前往連結(選填)</label><input value={form.link_url || ""} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://… 或留空不可點" /></div>
              <div><label>投放地區</label>
                <select value={form.region || "all"} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                  <option value="all">全站</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label>方案</label>
                <select value={form.tier || "free"} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                  {planOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </div>
              <div><label>檔期開始</label><input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} /></div>
              <div><label>檔期結束</label><input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} /></div>
              {isAdmin && <>
                <div><label>狀態</label>
                  <select value={form.status || "pending"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label>排序(小的在前)</label><input type="number" value={form.sort ?? 0} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) || 0 })} /></div>
              </>}
            </div>
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setForm(null)}>取消</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "儲存中…" : (isAdmin ? "儲存" : "送審核")}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
