"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { POI_KINDS, type Poi, type PoiKind } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const KIND_LABEL: Record<PoiKind, string> = { attraction: "景點", food: "美食", parking: "停車" };

type Form = Omit<Poi, "id"> & { id?: string };
const empty = (kind: PoiKind): Form => ({
  kind, name: "", region: REGIONS[0], town: "", address: "", description: "",
  image: "", website: "", lat: null, lng: null, published: true, featured: false,
});

export default function PlacesAdmin({ initial, kind }: { initial: Poi[]; kind: PoiKind }) {
  const [list, setList] = useState<Poi[]>(initial);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const label = KIND_LABEL[kind];

  const mine = useMemo(() => list.filter((p) => p.kind === kind), [list, kind]);
  const filtered = useMemo(() => mine.filter((p) => {
    if (q.trim()) {
      const hay = (p.name + p.region + p.town + p.address).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [mine, q]);

  const stats = useMemo(() => ({
    total: mine.length,
    published: mine.filter((p) => p.published).length,
    hidden: mine.filter((p) => !p.published).length,
    featured: mine.filter((p) => p.featured).length,
  }), [mine]);

  async function refresh() {
    const sb = createClient();
    const { data } = await sb.from("pois").select("*").order("created_at", { ascending: false });
    setList((data as Poi[]) || []);
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { alert("請選圖片檔"); return; }
    setUploading(true);
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    setUploading(false);
    if (error) { alert("上傳失敗:" + error.message); return; }
    const url = sb.storage.from("site").getPublicUrl(path).data.publicUrl;
    setForm((f) => (f ? { ...f, image: url } : f));
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { alert("請填名稱"); return; }
    setBusy(true);
    const sb = createClient();
    const payload = {
      kind, name: form.name.trim(), region: form.region, town: form.town.trim(),
      address: form.address.trim(), description: form.description.trim(), image: form.image.trim(),
      website: form.website.trim(),
      lat: form.lat === null || (form.lat as unknown as string) === "" ? null : Number(form.lat),
      lng: form.lng === null || (form.lng as unknown as string) === "" ? null : Number(form.lng),
      published: form.published, featured: form.featured,
    };
    let error;
    if (form.id) ({ error } = await sb.from("pois").update(payload).eq("id", form.id));
    else ({ error } = await sb.from("pois").insert(payload));
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setForm(null);
    await refresh();
  }

  async function togglePublish(p: Poi) {
    const sb = createClient();
    await sb.from("pois").update({ published: !p.published }).eq("id", p.id);
    await refresh();
  }
  async function remove(p: Poi) {
    if (!confirm(`確定刪除「${p.name}」?`)) return;
    const sb = createClient();
    await sb.from("pois").delete().eq("id", p.id);
    await refresh();
  }

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{stats.total}</div><div className="l">全部{label}</div></div>
        <div className="stat-card"><div className="n">{stats.published}</div><div className="l">已發布</div></div>
        <div className="stat-card"><div className="n">{stats.hidden}</div><div className="l">隱藏</div></div>
        <div className="stat-card"><div className="n">{stats.featured}</div><div className="l">精選</div></div>
      </div>

      <div className="admin-bar">
        <input className="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`搜尋${label}名稱、地區…`} />
        <button className="btn btn-primary" onClick={() => setForm(empty(kind))}>＋ 新增{label}</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th></th><th>名稱</th><th>地區</th><th>地址</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="empty-row">還沒有{label},點右上「新增{label}」開始。</td></tr>}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.image ? <img className="athumb" src={p.image} alt="" /> : <div className="athumb" />}</td>
                <td><b>{p.name}</b>{p.featured && <span className="pill feat" style={{ marginLeft: 8 }}>精選</span>}</td>
                <td>{p.region}{p.town ? " · " + p.town : ""}</td>
                <td style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.address || "—"}</td>
                <td><span className={"pill " + (p.published ? "live" : "draft")}>{p.published ? "已發布" : "隱藏"}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="lnk" onClick={() => setForm({ ...p })}>編輯</button>
                    <button className="lnk" onClick={() => togglePublish(p)}>{p.published ? "隱藏" : "發布"}</button>
                    <button className="lnk danger" onClick={() => remove(p)}>刪除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <>
          <div className="overlay" onClick={() => setForm(null)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{form.id ? "編輯" : "新增"}{label}</h2>
            <div className="form-grid">
              <div><label>名稱 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={kind === "food" ? "例:阿伯綠豆饌" : kind === "parking" ? "例:南灣停車場" : "例:龍磐公園"} /></div>
              <div><label>縣市</label><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label>鄉鎮市區</label><input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="例:恆春鎮" /></div>
              <div><label>官網 / 參考連結(選填)</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
              <div className="wide"><label>地址</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="完整地址(地圖導航用)" /></div>
              <div><label>緯度 lat(選填)</label><input value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })} placeholder="22.06" /></div>
              <div><label>經度 lng(選填)</label><input value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })} placeholder="120.85" /></div>
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
              <div className="wide"><label>介紹</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句話介紹" /></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
              <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 發布(前台可見)</label>
              <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> 精選</label>
            </div>
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setForm(null)}>取消</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>{busy ? "儲存中…" : "儲存"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
