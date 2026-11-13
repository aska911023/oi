"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { revalidatePois } from "@/app/actions";
import { KIND_TABLE, DETAILS, WEEKDAYS, type WeekHour } from "@/lib/places-config";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import PlacesImport from "@/components/admin/places-import";
import { type Place, type PoiKind } from "@/lib/types";
import type { Plan } from "@/components/admin/plans-editor";

export interface OwnerProfile { id: string; display_name: string | null; full_name: string | null; role: string }
export interface PlaceBd { kind: string; place_id: string; contacted: boolean; rejected: boolean; note: string | null }

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const KIND_LABEL: Record<PoiKind, string> = { attraction: "景點", food: "餐廳", parking: "停車", activity: "娛樂", catering: "外燴" };

type Form = Omit<Place, "id"> & { id?: string };
const empty = (): Form => ({
  name: "", region: REGIONS[0], town: "", address: "", description: "",
  image: "", images: [], website: "", lat: null, lng: null, details: {}, published: true, featured: false,
});

type ListItem = Record<string, string>;

export default function PlacesAdmin({ initial, kind, ownerId, ownersInitial = [], bdInitial = [], plans = [] }: {
  initial: Place[]; kind: PoiKind; ownerId?: string; ownersInitial?: OwnerProfile[]; bdInitial?: PlaceBd[]; plans?: Plan[];
}) {
  const table = KIND_TABLE[kind];
  const fields = DETAILS[kind];
  const isAdminView = !ownerId; // 業者自己的 /vendor 頁(有 ownerId)不顯示業主/洽談/授權等內部欄位
  const planByKey = Object.fromEntries(plans.map((p) => [p.key, p]));
  const planFeatured = (tier?: string | null) => (planByKey[tier || "free"]?.priority ?? 0) > 0;
  const planOptions = plans.length ? plans : [{ key: "free", name: "免費方案", room_pins: 0, priority: 0, sort: 0 }];
  const owners = Object.fromEntries(ownersInitial.map((o) => [o.id, o]));
  const ownerLabel = (id?: string | null) => {
    if (!id) return "平台自管";
    const o = owners[id];
    return o ? (o.display_name || o.full_name || id.slice(0, 8)) : id.slice(0, 8);
  };
  const [list, setList] = useState<Place[]>(initial);
  const [bd, setBd] = useState<Record<string, PlaceBd>>(() => Object.fromEntries(bdInitial.map((b) => [b.place_id, b])));
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  // 快捷匯入照片:只跳精簡上傳框,不用開整張編輯表
  const [photoFor, setPhotoFor] = useState<Place | null>(null);
  const [photoImgs, setPhotoImgs] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // 勾選批次上/下架
  const [tagInput, setTagInput] = useState<Record<string, string>>({}); // 各類型標籤的「自訂新增」輸入
  const label = KIND_LABEL[kind];

  const filtered = useMemo(() => list.filter((p) => {
    if (q.trim()) return (p.name + p.region + p.town + p.address).toLowerCase().includes(q.trim().toLowerCase());
    if (tab === "published") return p.published;
    if (tab === "draft") return !p.published;
    return true;
  }), [list, q, tab]);

  const stats = useMemo(() => ({
    total: list.length, published: list.filter((p) => p.published).length,
    hidden: list.filter((p) => !p.published).length, featured: list.filter((p) => p.featured).length,
  }), [list]);

  async function refresh() {
    const sb = createClient();
    const q = sb.from(table).select("*").order("created_at", { ascending: false });
    const { data } = await (ownerId ? q.eq("owner_id", ownerId) : q);
    setList((data as Place[]) || []);
    revalidatePois().catch(() => {});
  }

  // 洽談紀錄(place_bd,只有 admin)
  async function saveBd(placeId: string, patch: Partial<PlaceBd>) {
    const next: PlaceBd = { kind, place_id: placeId, contacted: bd[placeId]?.contacted ?? false, rejected: bd[placeId]?.rejected ?? false, note: bd[placeId]?.note ?? null, ...patch };
    setBd((p) => ({ ...p, [placeId]: next }));
    const { error } = await createClient().from("place_bd").upsert(next, { onConflict: "kind,place_id" });
    if (error) { alert("洽談紀錄儲存失敗:" + error.message); setBd((p) => ({ ...p, [placeId]: { ...next, ...bd[placeId] } })); }
  }
  // 審核:核准=同時上架;退回=同時下架
  async function toggleApprove(p: Place) {
    const approving = !p.approved;
    await createClient().from(table).update(approving ? { approved: true, published: true } : { approved: false, published: false }).eq("id", p.id);
    if (approving && p.owner_id) {
      await createClient().from("notifications").insert({ user_id: p.owner_id, kind: "place_approved", title: `你的${label}「${p.name}」已通過審核並上架 🎉`, href: "/vendor/places" });
    }
    logAdmin(approving ? "approve" : "reject", { type: "place", id: p.id, name: p.name, detail: { 類別: label } });
    await refresh();
  }
  // 曝光方案 / 授權期間
  async function setTier(p: Place, ad_tier: string) {
    const isLicense = (planByKey[ad_tier]?.name || "").includes("授權");
    await createClient().from(table).update({ ad_tier, featured: planFeatured(ad_tier), ...(isLicense ? {} : { ad_start: null, ad_end: null }) }).eq("id", p.id);
    logAdmin("set_tier", { type: "place", id: p.id, name: p.name, detail: { 類別: label, to: ad_tier } });
    await refresh();
  }
  async function setAdDates(p: Place, patch: { ad_start?: string | null; ad_end?: string | null }) {
    await createClient().from(table).update(patch).eq("id", p.id);
    await refresh();
  }

  // details 操作
  const d = (form?.details || {}) as Record<string, unknown>;
  const setDetail = (key: string, val: unknown) => setForm((f) => (f ? { ...f, details: { ...(f.details || {}), [key]: val } } : f));
  const getList = (key: string): ListItem[] => (Array.isArray(d[key]) ? (d[key] as ListItem[]) : []);
  const addItem = (key: string, cols: { key: string }[]) => setDetail(key, [...getList(key), Object.fromEntries(cols.map((c) => [c.key, ""]))]);
  const setItem = (key: string, i: number, colKey: string, v: string) => setDetail(key, getList(key).map((it, k) => (k === i ? { ...it, [colKey]: v } : it)));
  const rmItem = (key: string, i: number) => setDetail(key, getList(key).filter((_, k) => k !== i));
  // 每週營業時間:永遠回傳 7 天(照 WEEKDAYS 順序),缺的補空
  const getWeek = (key: string): WeekHour[] => {
    const cur = Array.isArray(d[key]) ? (d[key] as WeekHour[]) : [];
    return WEEKDAYS.map((day) => cur.find((x) => x.day === day) || { day, closed: false, open: "", close: "" });
  };
  const setWeek = (key: string, day: string, patch: Partial<WeekHour>) =>
    setDetail(key, getWeek(key).map((e) => (e.day === day ? { ...e, ...patch } : e)));

  async function uploadPdf(key: string, file: File) {
    if (file.type !== "application/pdf") { alert("請選 PDF 檔"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("檔案請小於 10MB"); return; }
    setPdfBusy(key);
    const sb = createClient();
    const path = `menu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.pdf`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, contentType: "application/pdf" });
    setPdfBusy(null);
    if (error) { alert("上傳失敗:" + error.message); return; }
    setDetail(key, sb.storage.from("site").getPublicUrl(path).data.publicUrl);
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { alert("請填名稱"); return; }
    setBusy(true);
    const sb = createClient();
    const payload = {
      name: form.name.trim(), region: form.region, town: form.town.trim(), address: form.address.trim(),
      description: form.description.trim(),
      image: (form.images && form.images[0]) || form.image.trim(),
      images: form.images || [],
      website: form.website.trim(),
      lat: form.lat ?? null, lng: form.lng ?? null, details: form.details || {},
      published: form.published,
      ...(isAdminView ? { featured: form.featured, ad_tier: form.ad_tier || "free", save_boost: Number(form.save_boost) || 0, approved: form.approved ?? true } : {}),
      ...(ownerId && !form.id ? { owner_id: ownerId } : {}),
    };
    let error;
    if (form.id) ({ error } = await sb.from(table).update(payload).eq("id", form.id));
    else ({ error } = await sb.from(table).insert(payload));
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    logAdmin(form.id ? "edit" : "create", { type: "place", id: form.id, name: payload.name, detail: { 類別: label } });
    setForm(null);
    await refresh();
  }

  function openPhotos(p: Place) {
    setPhotoFor(p);
    setPhotoImgs(p.images && p.images.length ? p.images : (p.image ? [p.image] : []));
  }
  async function savePhotos() {
    if (!photoFor) return;
    setPhotoBusy(true);
    const sb = createClient();
    const { error } = await sb.from(table).update({ images: photoImgs, image: photoImgs[0] || "" }).eq("id", photoFor.id);
    setPhotoBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    logAdmin("edit", { type: "place", id: photoFor.id, name: photoFor.name, detail: { 類別: label, 動作: "匯入照片" } });
    setPhotoFor(null);
    await refresh();
  }

  async function togglePublish(p: Place) {
    const sb = createClient();
    await sb.from(table).update({ published: !p.published }).eq("id", p.id);
    logAdmin(p.published ? "unpublish" : "publish", { type: "place", id: p.id, name: p.name, detail: { 類別: label } });
    await refresh();
  }
  async function remove(p: Place) {
    if (!confirm(`確定刪除「${p.name}」?`)) return;
    const sb = createClient();
    await sb.from(table).delete().eq("id", p.id);
    logAdmin("delete", { type: "place", id: p.id, name: p.name, detail: { 類別: label } });
    await refresh();
  }

  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (filtered.every((p) => n.has(p.id))) filtered.forEach((p) => n.delete(p.id)); else filtered.forEach((p) => n.add(p.id)); return n; });
  async function bulkPublish(pub: boolean) {
    const ids = [...selected]; if (!ids.length) return;
    const sb = createClient();
    const { error } = await sb.from(table).update({ published: pub }).in("id", ids);
    if (error) { alert("失敗:" + error.message); return; }
    logAdmin(pub ? "publish" : "unpublish", { type: "place", detail: { 類別: label, 批次: ids.length } });
    setSelected(new Set());
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
        <div className="seg">
          {(["all", "published", "draft"] as const).map((v) => (
            <button key={v} className={tab === v ? "on" : ""} onClick={() => setTab(v)}>{v === "all" ? "全部" : v === "published" ? "已上架" : "草稿"}</button>
          ))}
        </div>
        <PlacesImport kind={kind} existingNames={list.map((p) => p.name)} onDone={refresh} ownerId={ownerId} />
        <button className="btn btn-primary" onClick={() => setForm(empty())}>＋ 新增{label}</button>
      </div>

      {selected.size > 0 && (
        <div className="admin-bar" style={{ background: "var(--surface-2)", borderRadius: 10, padding: "8px 12px", alignItems: "center", marginTop: -8 }}>
          <b style={{ fontSize: 14 }}>已選 {selected.size} 筆</b>
          <button className="btn btn-primary btn-sm" onClick={() => bulkPublish(true)}>批次上架</button>
          <button className="btn btn-ghost btn-sm" onClick={() => bulkPublish(false)}>批次下架</button>
          <button className="lnk" onClick={() => setSelected(new Set())}>取消選取</button>
        </div>
      )}

      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th style={{ width: 30 }}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} title="全選本頁" /></th><th></th><th>名稱</th><th>地區</th><th>地址</th><th>狀態</th>{isAdminView && <><th>業主</th><th>洽談</th><th>內部備註</th></>}<th>操作</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={isAdminView ? 10 : 7} className="empty-row">還沒有{label},點右上「新增{label}」開始。</td></tr>}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} /></td>
                <td>{p.image ? <img className="athumb" src={p.image} alt="" /> : <div className="athumb" />}</td>
                <td><b>{p.name}</b>{p.featured && <span className="pill feat" style={{ marginLeft: 8 }}>精選</span>}</td>
                <td>{p.region}{p.town ? " · " + p.town : ""}</td>
                <td style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.address || "—"}</td>
                <td>{isAdminView
                  ? (p.approved === false ? <span className="pill draft">待審核</span> : <span className={"pill " + (p.published ? "live" : "draft")}>{p.published ? "已上架" : "草稿"}</span>)
                  : <span className={"pill " + (p.published ? "live" : "draft")}>{p.published ? "已發布" : "隱藏"}</span>}</td>
                {isAdminView && <>
                  <td style={{ fontSize: 12.5 }}>{ownerLabel(p.owner_id)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <label style={{ display: "block", fontSize: 12 }}><input type="checkbox" checked={!!bd[p.id]?.contacted} onChange={(e) => saveBd(p.id, { contacted: e.target.checked })} /> 已聯繫</label>
                    <label style={{ display: "block", fontSize: 12 }}><input type="checkbox" checked={!!bd[p.id]?.rejected} onChange={(e) => saveBd(p.id, { rejected: e.target.checked })} /> 拒絕</label>
                  </td>
                  <td><input defaultValue={bd[p.id]?.note || ""} placeholder="聯絡結果、報價…" onBlur={(e) => { if ((e.target.value || "") !== (bd[p.id]?.note || "")) saveBd(p.id, { note: e.target.value || null }); }} style={{ width: 150, fontSize: 12, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6 }} /></td>
                </>}
                <td>
                  <div className="row-actions">
                    {(() => { const n = p.images?.length || (p.image ? 1 : 0);
                      return <button className={"lnk" + (n ? "" : " danger")} title="快捷匯入照片" onClick={() => openPhotos(p)}>📷 {n ? `照片·${n}` : "加照片"}</button>; })()}
                    <button className="lnk" onClick={() => setForm({ ...p, details: p.details || {} })}>編輯</button>
                    {p.published && p.region && <a className="lnk" href={`/${encodeURIComponent(p.region)}/${kind === "food" ? "restaurant" : kind}/${encodeURIComponent(p.slug || p.id)}`} target="_blank" rel="noopener noreferrer" title="在前台開啟公開頁">前台 ↗</a>}
                    <button className="lnk" onClick={() => togglePublish(p)}>{p.published ? "隱藏" : "發布"}</button>
                    {isAdminView && <button className="lnk" onClick={() => toggleApprove(p)}>{p.approved === false ? "核准" : "退回審核"}</button>}
                    {isAdminView && (
                      <select className="tier-sel" value={p.ad_tier || "free"} onChange={(e) => setTier(p, e.target.value)} title="曝光方案">
                        {planOptions.map((pl) => <option key={pl.key} value={pl.key}>{pl.name}</option>)}
                      </select>
                    )}
                    <button className="lnk danger" onClick={() => remove(p)}>刪除</button>
                  </div>
                  {isAdminView && (planByKey[p.ad_tier || "free"]?.name || "").includes("授權") && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4, fontSize: 11 }}>
                      <span style={{ color: "var(--muted)" }}>授權</span>
                      <input type="date" value={p.ad_start || ""} onChange={(e) => setAdDates(p, { ad_start: e.target.value || null })} style={{ fontSize: 11, padding: "2px 4px", border: "1px solid var(--border-strong)", borderRadius: 6 }} title="開始" />
                      <span>→</span>
                      <input type="date" value={p.ad_end || ""} onChange={(e) => setAdDates(p, { ad_end: e.target.value || null })} style={{ fontSize: 11, padding: "2px 4px", border: "1px solid var(--border-strong)", borderRadius: 6 }} title="結束(到期自動降免費)" />
                    </div>
                  )}
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
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>直接選檔(可多選)或貼網址,第一張為封面。存檔後立即套用到前台。</p>
            <MultiImageUploader prefix="place" value={photoImgs} onChange={setPhotoImgs} />
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
            <h2>{form.id ? "編輯" : "新增"}{label}</h2>
            <div className="form-grid">
              <div><label>名稱 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label>縣市</label><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label>鄉鎮市區</label><input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} /></div>
              <div><label>官網 / 參考連結</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
              <div className="wide"><label>地址</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="完整地址(地圖導航用)" /></div>
              <div><label>緯度 lat</label><input value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><label>經度 lng</label><input value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="wide"><label>相簿(可多張,第一張為封面,前台會輪播)</label>
                <MultiImageUploader prefix="place"
                  value={form.images && form.images.length ? form.images : (form.image ? [form.image] : [])}
                  onChange={(imgs) => setForm((f) => (f ? { ...f, images: imgs, image: imgs[0] || "" } : f))} />
              </div>
              <div className="wide"><label>介紹</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>

            {/* 分類專屬 details */}
            <div className="details-form">
              <div className="rt-head" style={{ marginTop: 6 }}><b>{label}資訊</b></div>
              {fields.filter((f) => f.type === "tags").map((f) => f.type === "tags" && (() => {
                const sel = getList(f.key) as unknown as string[];
                const extras = sel.filter((t) => !f.options.includes(t)); // 已存在的自訂標籤(不在預設清單)
                const toggle = (opt: string) => { const set = new Set(sel); set.has(opt) ? set.delete(opt) : set.add(opt); setDetail(f.key, [...set]); };
                const addCustom = () => {
                  const t = (tagInput[f.key] || "").trim();
                  if (t && !sel.includes(t)) setDetail(f.key, [...sel, t]);
                  setTagInput((m) => ({ ...m, [f.key]: "" }));
                };
                return (
                  <div key={f.key} className="dlist">
                    <label>{f.label}(可複選)</label>
                    <div className="fac-grid">
                      {[...f.options, ...extras].map((opt) => (
                        <button type="button" key={opt} className={"chip" + (sel.includes(opt) ? " on" : "")}
                          onClick={() => toggle(opt)}>{opt}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input style={{ flex: 1 }} value={tagInput[f.key] || ""} placeholder="自訂標籤…打字後按新增(或 Enter)"
                        onChange={(e) => setTagInput((m) => ({ ...m, [f.key]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={addCustom}>＋ 新增</button>
                    </div>
                  </div>
                );
              })())}
              <div className="form-grid">
                {fields.filter((f) => f.type === "text").map((f) => (
                  <div key={f.key}><label>{f.label}</label>
                    <input value={String(d[f.key] ?? "")} onChange={(e) => setDetail(f.key, e.target.value)} /></div>
                ))}
              </div>
              {fields.filter((f) => f.type === "pdf").map((f) => (
                <div key={f.key} className="dlist">
                  <label>{f.label}</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                      {pdfBusy === f.key ? "上傳中…" : d[f.key] ? "更換 PDF" : "選 PDF 上傳"}
                      <input type="file" accept="application/pdf" style={{ display: "none" }} disabled={pdfBusy !== null}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(f.key, file); }} />
                    </label>
                    {d[f.key] ? <a className="lnk" href={String(d[f.key])} target="_blank" rel="noopener noreferrer">檢視目前檔案</a> : <span style={{ fontSize: 13, color: "var(--muted)" }}>尚未上傳</span>}
                    {d[f.key] ? <button className="lnk danger" onClick={() => setDetail(f.key, "")}>移除</button> : null}
                  </div>
                </div>
              ))}
              {fields.filter((f) => f.type === "weekhours").map((f) => (
                <div key={f.key} className="dlist">
                  <label>{f.label}</label>
                  <div className="wh-editor">
                    {getWeek(f.key).map((e) => (
                      <div className="wh-row" key={e.day}>
                        <span className="wh-day">{e.day}</span>
                        <label className="wh-closed"><input type="checkbox" checked={!!e.closed} onChange={(ev) => setWeek(f.key, e.day, { closed: ev.target.checked })} /> 休息</label>
                        {!e.closed && (
                          <span className="wh-times">
                            <input type="text" inputMode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" placeholder="09:00" value={e.open || ""} onChange={(ev) => setWeek(f.key, e.day, { open: ev.target.value })} />
                            <span>–</span>
                            <input type="text" inputMode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" placeholder="18:00" value={e.close || ""} onChange={(ev) => setWeek(f.key, e.day, { close: ev.target.value })} />
                            <span className="wh-24">24小時制</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {fields.filter((f) => f.type === "list").map((f) => f.type === "list" && (
                <div key={f.key} className="dlist">
                  <label>{f.label}</label>
                  {getList(f.key).map((it, i) => (
                    <div className="dlist-row" key={i}>
                      {f.cols.map((c) => (
                        <input key={c.key} value={it[c.key] || ""} placeholder={c.label} onChange={(e) => setItem(f.key, i, c.key, e.target.value)} />
                      ))}
                      <button className="lnk danger" onClick={() => rmItem(f.key, i)}>刪</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => addItem(f.key, f.cols)}>＋ 新增一筆</button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 發布(前台可見)</label>
              {isAdminView && <>
                <label className="check"><input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> 精選</label>
                <label className="check" style={{ gap: 6 }}><span>曝光方案</span>
                  <select value={form.ad_tier || "free"} onChange={(e) => setForm({ ...form, ad_tier: e.target.value })} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-strong)" }}>
                    {planOptions.map((pl) => <option key={pl.key} value={pl.key}>{pl.name}</option>)}
                  </select>
                </label>
                <label className="check" style={{ gap: 6 }}><span>收藏數墊高</span>
                  <input type="number" min={0} value={form.save_boost ?? 0} onChange={(e) => setForm({ ...form, save_boost: Number(e.target.value) || 0 })} style={{ width: 80, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
                </label>
              </>}
            </div>
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setForm(null)}>取消</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "儲存中…" : "儲存"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
