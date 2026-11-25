"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { revalidateEvents } from "@/app/actions";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import type { Plan } from "@/components/admin/plans-editor";

export interface Happening {
  id: string; slug?: string; title: string; image: string; images?: string[]; category: string;
  region: string; town: string; address: string; lat?: number | null; lng?: number | null;
  start_date: string | null; end_date: string | null; start_time: string; end_time: string;
  all_day: boolean; is_free: boolean; indoor: boolean; description: string; link_url: string;
  owner_id?: string | null; published: boolean; approved: boolean; featured: boolean;
  ad_tier: string; ad_start: string | null; ad_end: string | null; save_boost: number;
}
const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
export const EVENT_CATEGORIES = ["市集", "手作體驗", "展覽", "親子", "季節活動", "音樂表演", "運動", "講座", "其他"];

type Form = Partial<Happening> & { images?: string[] };
const empty = (): Form => ({ title: "", category: "市集", region: REGIONS[0], town: "", address: "", description: "", link_url: "",
  start_date: "", end_date: "", start_time: "", end_time: "", all_day: false, is_free: false, indoor: false, images: [], published: true });

function statusOf(h: Happening): { label: string; pill: string } {
  if (!h.approved) return { label: "待審核", pill: "pending" };
  return h.published ? { label: "已上架", pill: "live" } : { label: "草稿", pill: "draft" };
}

export default function EventsAdmin({ initial, mode, ownerId, plans = [] }: {
  initial: Happening[]; mode: "admin" | "vendor"; ownerId?: string; plans?: Plan[];
}) {
  const isAdmin = mode === "admin";
  const [list, setList] = useState<Happening[]>(initial);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const planOptions = plans.length ? plans : [{ key: "free", name: "免費方案", room_pins: 0, priority: 0, sort: 0 }];
  const planFeatured = (t?: string | null) => (planOptions.find((p) => p.key === (t || "free"))?.priority ?? 0) > 0;

  const filtered = useMemo(() => list.filter((h) => !q.trim() || (h.title + h.region + h.town + h.category).toLowerCase().includes(q.trim().toLowerCase())), [list, q]);
  const stats = useMemo(() => ({
    pending: list.filter((h) => !h.approved).length,
    live: list.filter((h) => h.approved && h.published).length,
  }), [list]);

  async function refresh() {
    const sb = createClient();
    let qy = sb.from("happenings").select("*").order("start_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (ownerId) qy = qy.eq("owner_id", ownerId);
    const { data } = await qy;
    setList((data as Happening[]) || []);
    revalidateEvents().catch(() => {});
  }

  async function save() {
    if (!form) return;
    if (!form.title?.trim()) { alert("請填活動名稱"); return; }
    setBusy(true);
    const sb = createClient();
    const image = form.images?.[0] || form.image || "";
    const payload: Record<string, unknown> = {
      title: form.title.trim(), category: form.category || "其他", region: form.region || REGIONS[0],
      town: (form.town || "").trim(), address: (form.address || "").trim(), description: (form.description || "").trim(),
      link_url: (form.link_url || "").trim(), image, images: form.images || [], has_image: !!image,
      lat: form.lat ?? null, lng: form.lng ?? null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      start_time: form.start_time || "", end_time: form.end_time || "",
      all_day: !!form.all_day, is_free: !!form.is_free, indoor: !!form.indoor,
      ...(isAdmin ? { published: form.published ?? true, featured: !!form.featured, ad_tier: form.ad_tier || "free", save_boost: Number(form.save_boost) || 0, approved: form.approved ?? true } : {}),
      ...(ownerId && !form.id ? { owner_id: ownerId } : {}),
    };
    let error;
    if (form.id) ({ error } = await sb.from("happenings").update(payload).eq("id", form.id));
    else ({ error } = await sb.from("happenings").insert(payload));
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    logAdmin(form.id ? "edit" : "create", { type: "event", id: form.id, name: payload.title as string });
    setForm(null);
    await refresh();
  }

  async function approve(h: Happening) {
    await createClient().from("happenings").update({ approved: true, published: true }).eq("id", h.id);
    if (h.owner_id) await createClient().from("notifications").insert({ user_id: h.owner_id, kind: "event_approved", title: `你的活動「${h.title}」已通過審核並上架 🎉`, href: "/vendor/events" });
    logAdmin("approve", { type: "event", id: h.id, name: h.title });
    await refresh();
  }
  async function reject(h: Happening) {
    await createClient().from("happenings").update({ approved: false, published: false }).eq("id", h.id);
    logAdmin("reject", { type: "event", id: h.id, name: h.title });
    await refresh();
  }
  async function togglePublish(h: Happening) {
    await createClient().from("happenings").update({ published: !h.published }).eq("id", h.id);
    await refresh();
  }
  async function setTier(h: Happening, ad_tier: string) {
    await createClient().from("happenings").update({ ad_tier, featured: planFeatured(ad_tier) }).eq("id", h.id);
    await refresh();
  }
  async function remove(h: Happening) {
    if (!confirm(`確定刪除活動「${h.title}」?`)) return;
    await createClient().from("happenings").delete().eq("id", h.id);
    await refresh();
  }

  const dateStr = (h: Happening) => h.start_date ? (h.end_date && h.end_date !== h.start_date ? `${h.start_date} ~ ${h.end_date}` : h.start_date) : "長期";

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n" style={{ color: stats.pending ? "var(--accent-orange,#b4690e)" : undefined }}>{stats.pending}</div><div className="l">待審核</div></div>
        <div className="stat-card"><div className="n">{stats.live}</div><div className="l">已上架</div></div>
        <div className="stat-card"><div className="n">{list.length}</div><div className="l">全部</div></div>
      </div>

      <div className="admin-bar">
        <input className="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋活動名稱、地區、分類…" />
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setForm(empty())}>＋ 新增活動</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th></th><th>活動</th><th>分類</th><th>地區</th><th>日期</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="empty-row">{isAdmin ? "還沒有活動,點右上「新增活動」開始。" : "還沒投稿活動,點右上「新增活動」送審曝光。"}</td></tr>}
            {filtered.map((h) => {
              const st = statusOf(h);
              return (
                <tr key={h.id}>
                  <td>{h.image ? <img className="athumb" src={h.image} alt="" /> : <div className="athumb" />}</td>
                  <td><b>{h.title}</b>{h.featured && <span className="pill feat" style={{ marginLeft: 8 }}>精選</span>}{h.is_free && <span className="pill" style={{ marginLeft: 6 }}>免費</span>}</td>
                  <td>{h.category}</td>
                  <td>{h.region}{h.town ? " · " + h.town : ""}</td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{dateStr(h)}</td>
                  <td><span className={"pill " + st.pill}>{st.label}</span></td>
                  <td>
                    <div className="row-actions">
                      {isAdmin && !h.approved && <button className="lnk" onClick={() => approve(h)}>核准</button>}
                      {isAdmin && h.approved && <button className="lnk danger" onClick={() => reject(h)}>退回</button>}
                      <button className="lnk" onClick={() => setForm({ ...h, images: h.images?.length ? h.images : (h.image ? [h.image] : []) })}>編輯</button>
                      {h.published && h.slug && <a className="lnk" href={`/events/${encodeURIComponent(h.slug)}`} target="_blank" rel="noopener noreferrer">前台 ↗</a>}
                      {isAdmin && h.approved && <button className="lnk" onClick={() => togglePublish(h)}>{h.published ? "隱藏" : "發布"}</button>}
                      {isAdmin && (
                        <select className="tier-sel" value={h.ad_tier || "free"} onChange={(e) => setTier(h, e.target.value)} title="曝光方案">
                          {planOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select>
                      )}
                      <button className="lnk danger" onClick={() => remove(h)}>刪除</button>
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
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{form.id ? "編輯" : "新增"}活動</h2>
            {!isAdmin && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>送出後需經平台審核,通過才會上架曝光。</p>}
            <div className="form-grid">
              <div className="wide"><label>活動名稱 *</label><input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><label>分類</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label>縣市</label><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label>鄉鎮市區</label><input value={form.town || ""} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="例:礁溪鄉" /></div>
              <div><label>報名 / 官方連結</label><input value={form.link_url || ""} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" /></div>
              <div className="wide"><label>地址</label><input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="地圖導航用" /></div>
              <div><label>緯度 lat</label><input value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><label>經度 lng</label><input value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><label>開始日期</label><input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} /></div>
              <div><label>結束日期(單日可空)</label><input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} /></div>
              <div><label>開始時間</label><input value={form.start_time || ""} onChange={(e) => setForm({ ...form, start_time: e.target.value })} placeholder="例:10:00" /></div>
              <div><label>結束時間</label><input value={form.end_time || ""} onChange={(e) => setForm({ ...form, end_time: e.target.value })} placeholder="例:18:00" /></div>
              <div className="wide"><label>活動圖(建議橫幅)</label>
                <MultiImageUploader prefix="event" value={form.images && form.images.length ? form.images : (form.image ? [form.image] : [])} onChange={(imgs) => setForm((f) => (f ? { ...f, images: imgs, image: imgs[0] || "" } : f))} />
              </div>
              <div className="wide"><label>活動介紹</label><textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label className="check"><input type="checkbox" checked={!!form.is_free} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} /> 免費活動</label>
              <label className="check"><input type="checkbox" checked={!!form.indoor} onChange={(e) => setForm({ ...form, indoor: e.target.checked })} /> 室內 / 雨天備案</label>
              {isAdmin && <>
                <label className="check"><input type="checkbox" checked={form.published ?? true} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 上架(前台可見)</label>
                <label className="check"><input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> 精選</label>
                <label className="check" style={{ gap: 6 }}><span>曝光方案</span>
                  <select value={form.ad_tier || "free"} onChange={(e) => setForm({ ...form, ad_tier: e.target.value })} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-strong)" }}>
                    {planOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                </label>
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
