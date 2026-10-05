"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS, CATEGORIES, AMENITY_OPTIONS } from "@/lib/data";
import { revalidateStays } from "@/app/actions";
import RoomTypesEditor from "@/components/admin/room-types-editor";
import StaysImport from "@/components/admin/stays-import";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import type { Stay } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);

type Form = Omit<Stay, "id"> & { id?: string };
const EMPTY: Form = {
  name: "", region: REGIONS[0], town: "", category: "設計旅宿",
  price: 0, guests: 1, image: "", images: [], description: "", amenities: "",
  website: "", embed_urls: [], rooms_left: null, address: "", lat: null, lng: null,
  license_no: "", check_in: "", check_out: "",
  published: false, featured: false, sample: false, ad_tier: "free", save_boost: 0,
};

export default function StaysAdmin({ initial, ownerId }: { initial: Stay[]; ownerId?: string }) {
  const [list, setList] = useState<Stay[]>(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => ({
    total: list.length,
    published: list.filter((s) => s.published).length,
    draft: list.filter((s) => !s.published).length,
    featured: list.filter((s) => s.featured).length,
  }), [list]);

  const filtered = useMemo(() => list.filter((s) => {
    if (status === "published" && !s.published) return false;
    if (status === "draft" && s.published) return false;
    if (q.trim()) {
      const hay = (s.name + s.region + s.town + s.category).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [list, q, status]);

  async function refresh() {
    const sb = createClient();
    let query = sb.from("stays").select("*").order("created_at", { ascending: false });
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data } = await query;
    setList((data as Stay[]) || []);
    revalidateStays().catch(() => {}); // 讓前台讀取快取即時失效
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.town.trim()) { alert("請填名稱與鄉鎮市區"); return; }
    setBusy(true);
    const sb = createClient();
    const payload = {
      name: form.name.trim(), region: form.region, town: form.town.trim(),
      category: form.category, price: Number(form.price) || 0, guests: Number(form.guests) || 1,
      image: (form.images && form.images[0]) || form.image.trim(),
      images: form.images || [],
      description: form.description.trim(), amenities: form.amenities.trim(),
      website: form.website.trim(),
      embed_urls: (form.embed_urls || []).map((u) => u.trim()).filter(Boolean),
      rooms_left: form.rooms_left === null || form.rooms_left === undefined || (form.rooms_left as unknown as string) === "" ? null : Number(form.rooms_left),
      address: (form.address || "").trim(),
      lat: form.lat === null || form.lat === undefined || (form.lat as unknown as string) === "" ? null : Number(form.lat),
      lng: form.lng === null || form.lng === undefined || (form.lng as unknown as string) === "" ? null : Number(form.lng),
      license_no: (form.license_no || "").trim() || null,
      check_in: (form.check_in || "").trim() || null,
      check_out: (form.check_out || "").trim() || null,
      published: form.published, featured: form.featured, sample: form.sample,
      ad_tier: ownerId ? undefined : (form.ad_tier || "free"), // 曝光方案只有 admin 能設
      save_boost: ownerId ? undefined : (Number(form.save_boost) || 0), // 收藏數墊高只有 admin 能設
      owner_id: ownerId ?? undefined,
      approved: ownerId ? undefined : true, // admin 建立自動核准;業者建立維持待審
    };
    let error, newId = form.id;
    if (form.id) {
      ({ error } = await sb.from("stays").update(payload).eq("id", form.id));
    } else {
      const { data, error: e } = await sb.from("stays").insert(payload).select("id").single();
      error = e; if (data) newId = data.id;
    }
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    // 新建後留在編輯狀態,讓下方「房型管理」立刻出現
    setForm((f) => (f ? { ...f, id: newId } : f));
    await refresh();
  }

  async function togglePublish(s: Stay) {
    const sb = createClient();
    await sb.from("stays").update({ published: !s.published }).eq("id", s.id);
    await refresh();
  }
  async function toggleApprove(s: Stay) {
    const sb = createClient();
    await sb.from("stays").update({ approved: !s.approved }).eq("id", s.id);
    await refresh();
  }
  async function remove(s: Stay) {
    if (!confirm(`確定刪除「${s.name}」?此動作無法復原。`)) return;
    const sb = createClient();
    await sb.from("stays").delete().eq("id", s.id);
    await refresh();
  }

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{stats.total}</div><div className="l">全部民宿</div></div>
        <div className="stat-card"><div className="n">{stats.published}</div><div className="l">已上架</div></div>
        <div className="stat-card"><div className="n">{stats.draft}</div><div className="l">草稿 / 下架</div></div>
        <div className="stat-card"><div className="n">{stats.featured}</div><div className="l">精選置頂</div></div>
      </div>

      <div className="admin-bar">
        <input className="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱、地區、鄉鎮…" />
        <div className="seg">
          {(["all", "published", "draft"] as const).map((v) => (
            <button key={v} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>
              {v === "all" ? "全部" : v === "published" ? "已上架" : "草稿"}
            </button>
          ))}
        </div>
        <StaysImport existingNames={list.map((s) => s.name)} onDone={refresh} />
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>＋ 新增民宿</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr><th></th><th>名稱</th><th>地區</th><th>風格</th><th>狀態</th><th>操作</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="empty-row">沒有符合的民宿。點「新增民宿」開始上架。</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.image ? <img className="athumb" src={s.image} alt="" /> : <div className="athumb" />}</td>
                <td><b>{s.name}</b>{s.featured && <span className="pill feat" style={{ marginLeft: 8 }}>置頂</span>}</td>
                <td>{s.region} · {s.town}</td>
                <td>{s.category}</td>
                <td>
                  {s.approved === false
                    ? <span className="pill pending">待審核</span>
                    : <span className={"pill " + (s.published ? "live" : "draft")}>{s.published ? "已上架" : "草稿"}</span>}
                </td>
                <td>
                  <div className="row-actions">
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

      {form && (
        <>
          <div className="overlay" onClick={() => setForm(null)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{form.id ? "編輯民宿" : "新增民宿"}</h2>
            <div className="form-grid">
              <div className="wide"><label>名稱 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例:海邊的日子" /></div>
              <div><label>縣市</label><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label>鄉鎮市區 *</label><input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="例:恆春鎮" /></div>
              <div><label>風格</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Stay["category"] })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="wide"><label>合法民宿登記證號(選填,顯示於前台增加信任)</label><input value={form.license_no || ""} onChange={(e) => setForm({ ...form, license_no: e.target.value })} placeholder="例:宜蘭縣民宿第 000123 號" /></div>
              <div className="wide"><label>地址(Google 地圖 / 導航用)</label><input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="例:屏東縣恆春鎮…" /></div>
              <div><label>緯度 lat(選填)</label><input value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })} placeholder="22.00" /></div>
              <div><label>經度 lng(選填)</label><input value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })} placeholder="120.74" /></div>
              <div><label>最早入住時間</label><input value={form.check_in || ""} onChange={(e) => setForm({ ...form, check_in: e.target.value })} placeholder="例:15:00" /></div>
              <div><label>最晚退房時間</label><input value={form.check_out || ""} onChange={(e) => setForm({ ...form, check_out: e.target.value })} placeholder="例:11:00" /></div>
              <div className="wide"><label>設施 / 服務(可複選)</label>
                <div className="fac-grid">
                  {AMENITY_OPTIONS.map((a) => {
                    const set = new Set((form.amenities || "").split("、").map((s) => s.trim()).filter(Boolean));
                    const on = set.has(a);
                    return <button type="button" key={a} className={"chip" + (on ? " on" : "")}
                      onClick={() => { on ? set.delete(a) : set.add(a); setForm({ ...form, amenities: [...set].join("、") }); }}>{a}</button>;
                  })}
                </div>
              </div>
              <div className="wide"><label>封面相簿(可多張,第一張為封面,前台會輪播)</label>
                <MultiImageUploader prefix="stay"
                  value={form.images && form.images.length ? form.images : (form.image ? [form.image] : [])}
                  onChange={(imgs) => setForm({ ...form, images: imgs, image: imgs[0] || "" })} />
              </div>
              <div className="wide"><label>官網 / 訂房連結(導流,選填)</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
              <div className="wide"><label>影片介紹 / 網紅推薦(YouTube / IG / TikTok,可多個,一行一個)</label><textarea rows={3} value={(form.embed_urls || []).join("\n")} onChange={(e) => setForm({ ...form, embed_urls: e.target.value.split("\n") })} placeholder={"https://youtu.be/…\nhttps://instagram.com/p/…\nhttps://tiktok.com/@…/video/…"} /></div>
              <div className="wide"><label>介紹</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句話賣點" /></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
              <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 店家上架(前台可見)</label>
              {!ownerId && (
                <label className="check" style={{ gap: 6 }}>曝光
                  <select value={form.ad_tier || "free"} onChange={(e) => setForm({ ...form, ad_tier: e.target.value })} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-strong)" }}>
                    <option value="free">一般</option>
                    <option value="featured">精選(優先曝光)</option>
                  </select>
                </label>
              )}
              {!ownerId && (
                <label className="check" style={{ gap: 6 }}>收藏數墊高
                  <input type="number" min={0} value={form.save_boost ?? 0} onChange={(e) => setForm({ ...form, save_boost: Number(e.target.value) })} style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border-strong)" }} />
                </label>
              )}
            </div>

            {form.id ? (
              <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <RoomTypesEditor stayId={form.id} allowFeatured={!ownerId} onChange={() => revalidateStays().catch(() => {})} />
              </div>
            ) : (
              <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>先按下方「儲存」,這間民宿的「房型管理」就會出現在這裡(價格、剩餘間數以房型為準)。</p>
            )}

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
