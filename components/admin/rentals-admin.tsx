"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";
import { GEOGRAPHIC_AREAS, RENTAL_TAGS } from "@/lib/data";
import { revalidateRentals } from "@/app/actions";
import RentalPlansEditor from "@/components/admin/rental-plans-editor";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import type { RentalShop } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
type Form = Omit<RentalShop, "id" | "price_from" | "units_left"> & { id?: string };
const EMPTY: Form = {
  name: "", region: REGIONS[0], town: "", address: "", phone: "", image: "", description: "",
  website: "", line_url: "", lat: null, lng: null, tags: [], published: false, featured: false,
};

export default function RentalsAdmin({ initial, ownerId }: { initial: RentalShop[]; ownerId?: string }) {
  const [list, setList] = useState<RentalShop[]>(initial);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // 快捷匯入照片:只跳精簡上傳框,不用開整張編輯表(租車只存單張,取第一張)
  const [photoFor, setPhotoFor] = useState<RentalShop | null>(null);
  const [photoImgs, setPhotoImgs] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const filtered = useMemo(() => list.filter((s) => {
    if (!q.trim()) return true;
    return (s.name + s.region + s.town).toLowerCase().includes(q.trim().toLowerCase());
  }), [list, q]);

  const stats = useMemo(() => ({
    total: list.length, published: list.filter((s) => s.published).length,
    draft: list.filter((s) => !s.published).length, featured: list.filter((s) => s.featured).length,
  }), [list]);

  async function refresh() {
    const sb = createClient();
    let query = sb.from("rental_shops").select("*").order("created_at", { ascending: false });
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data } = await query;
    setList((data as RentalShop[]) || []);
    revalidateRentals().catch(() => {});
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { alert("請選圖片檔"); return; }
    setUploading(true);
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `rental-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    setUploading(false);
    if (error) { alert("上傳失敗:" + error.message); return; }
    const url = sb.storage.from("site").getPublicUrl(path).data.publicUrl;
    setForm((f) => (f ? { ...f, image: url } : f));
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { alert("請填店名"); return; }
    setBusy(true);
    const sb = createClient();
    const payload = {
      name: form.name.trim(), region: form.region, town: form.town.trim(), address: form.address.trim(),
      phone: form.phone || null, image: form.image.trim(), description: form.description.trim(),
      website: form.website.trim(), line_url: form.line_url || null,
      lat: form.lat ?? null, lng: form.lng ?? null, tags: form.tags || [], published: form.published, featured: form.featured,
      owner_id: ownerId ?? undefined,
      approved: ownerId ? undefined : true,
    };
    let error, newId = form.id;
    if (form.id) ({ error } = await sb.from("rental_shops").update(payload).eq("id", form.id));
    else { const { data, error: e } = await sb.from("rental_shops").insert(payload).select("id").single(); error = e; if (data) newId = data.id; }
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    if (!ownerId) logAdmin(form.id ? "edit" : "create", { type: "rental", id: newId, name: payload.name });
    setForm((f) => (f ? { ...f, id: newId } : f)); // 保留在編輯狀態以便加方案
    await refresh();
  }

  function openPhotos(s: RentalShop) {
    setPhotoFor(s);
    setPhotoImgs(s.image ? [s.image] : []);
  }
  async function savePhotos() {
    if (!photoFor) return;
    setPhotoBusy(true);
    const sb = createClient();
    const { error } = await sb.from("rental_shops").update({ image: photoImgs[0] || "" }).eq("id", photoFor.id);
    setPhotoBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    if (!ownerId) logAdmin("edit", { type: "rental", id: photoFor.id, name: photoFor.name, detail: { 動作: "匯入照片" } });
    setPhotoFor(null);
    await refresh();
  }

  async function togglePublish(s: RentalShop) {
    const sb = createClient();
    await sb.from("rental_shops").update({ published: !s.published }).eq("id", s.id);
    if (!ownerId) logAdmin(s.published ? "unpublish" : "publish", { type: "rental", id: s.id, name: s.name });
    await refresh();
  }
  async function toggleApprove(s: RentalShop) {
    const sb = createClient();
    await sb.from("rental_shops").update({ approved: !s.approved }).eq("id", s.id);
    if (!ownerId) logAdmin(s.approved ? "reject" : "approve", { type: "rental", id: s.id, name: s.name });
    await refresh();
  }
  async function remove(s: RentalShop) {
    if (!confirm(`確定刪除「${s.name}」?其方案也會一併刪除。`)) return;
    const sb = createClient();
    await sb.from("rental_shops").delete().eq("id", s.id);
    if (!ownerId) logAdmin("delete", { type: "rental", id: s.id, name: s.name });
    await refresh();
  }

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{stats.total}</div><div className="l">全部店家</div></div>
        <div className="stat-card"><div className="n">{stats.published}</div><div className="l">已上架</div></div>
        <div className="stat-card"><div className="n">{stats.draft}</div><div className="l">草稿 / 下架</div></div>
        <div className="stat-card"><div className="n">{stats.featured}</div><div className="l">精選</div></div>
      </div>

      <div className="admin-bar">
        <input className="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋店名、地區…" />
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>＋ 新增租車店</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th></th><th>店名</th><th>地區</th><th>電話</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="empty-row">還沒有租車店,點右上「新增租車店」。</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.image ? <img className="athumb" src={s.image} alt="" /> : <div className="athumb" />}</td>
                <td><b>{s.name}</b>{s.featured && <span className="pill feat" style={{ marginLeft: 8 }}>精選</span>}</td>
                <td>{s.region}{s.town ? " · " + s.town : ""}</td>
                <td>{s.phone || "—"}</td>
                <td>
                  {s.approved === false
                    ? <span className="pill pending">待審核</span>
                    : <span className={"pill " + (s.published ? "live" : "draft")}>{s.published ? "已上架" : "草稿"}</span>}
                </td>
                <td>
                  <div className="row-actions">
                    <button className={"lnk" + (s.image ? "" : " danger")} title="快捷匯入照片" onClick={() => openPhotos(s)}>📷 {s.image ? "照片" : "加照片"}</button>
                    <button className="lnk" onClick={() => setForm({ ...s })}>編輯</button>
                    <button className="lnk" onClick={() => togglePublish(s)}>{s.published ? "下架" : "上架"}</button>
                    {!ownerId && <button className="lnk" onClick={() => toggleApprove(s)}>{s.approved ? "退回審核" : "核准"}</button>}
                    <button className="lnk danger" onClick={() => remove(s)}>刪除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {photoFor && (
        <>
          <div className="overlay" onClick={() => setPhotoFor(null)} />
          <div className="editor" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
            <h2>匯入照片 — {photoFor.name}</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>直接選檔或貼網址,存檔後立即套用到前台(租車店顯示第一張)。</p>
            <MultiImageUploader prefix="rental" value={photoImgs} onChange={setPhotoImgs} />
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setPhotoFor(null)}>取消</button>
              <button className="btn btn-primary" onClick={savePhotos} disabled={photoBusy}>{photoBusy ? "儲存中…" : "儲存照片"}</button>
            </div>
          </div>
        </>
      )}

      {form && (
        <>
          <div className="overlay" onClick={() => setForm(null)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{form.id ? "編輯租車店" : "新增租車店"}</h2>
            <div className="form-grid">
              <div><label>店名 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例:墾丁小虎租車" /></div>
              <div><label>縣市</label><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label>鄉鎮市區</label><input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="例:恆春鎮" /></div>
              <div><label>電話</label><input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="wide"><label>地址</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="取車地點(地圖導航用)" /></div>
              <div><label>官網</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
              <div><label>官方 LINE</label><input value={form.line_url || ""} onChange={(e) => setForm({ ...form, line_url: e.target.value })} placeholder="LINE 連結或 ID" /></div>
              <div><label>緯度 lat(選填)</label><input value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><label>經度 lng(選填)</label><input value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="wide"><label>圖片</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {form.image && <img src={form.image} alt="" style={{ height: 44, borderRadius: 8 }} />}
                  <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                    {uploading ? "上傳中…" : form.image ? "更換" : "選檔上傳"}
                    <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                  </label>
                  <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="或貼圖片網址" style={{ flex: 1, minWidth: 160 }} />
                </div>
              </div>
              <div className="wide"><label>介紹</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句話介紹" /></div>
              <div className="wide"><label>車種 / 品牌(可複選)</label>
                <div className="fac-grid">
                  {RENTAL_TAGS.map((t) => {
                    const set = new Set(form.tags || []);
                    const on = set.has(t);
                    return <button type="button" key={t} className={"chip" + (on ? " on" : "")} onClick={() => { on ? set.delete(t) : set.add(t); setForm({ ...form, tags: [...set] }); }}>{t}</button>;
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
              <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 上架(前台可見)</label>
              {!ownerId && <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> 精選</label>}
            </div>

            {form.id ? (
              <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <RentalPlansEditor shopId={form.id} onChange={() => revalidateRentals().catch(() => {})} />
              </div>
            ) : (
              <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>先按「儲存」建立店家,再新增方案(日租、可租數以方案為準)。</p>
            )}

            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setForm(null)}>關閉</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>{busy ? "儲存中…" : "儲存店家"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
