"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin as writeAdminLog } from "@/lib/admin-log";
import { GEOGRAPHIC_AREAS, CATEGORIES, AMENITY_OPTIONS } from "@/lib/data";
import { revalidateStays } from "@/app/actions";
import RoomTypesEditor from "@/components/admin/room-types-editor";
import TagPalette from "@/components/admin/tag-palette";
import StaysImport from "@/components/admin/stays-import";
import StayOwnerAssign from "@/components/admin/stay-owner-assign";
import MultiImageUploader from "@/components/admin/multi-image-uploader";
import type { Stay } from "@/lib/types";
import type { Plan } from "@/components/admin/plans-editor";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);

type Form = Omit<Stay, "id"> & { id?: string };
const EMPTY: Form = {
  name: "", region: REGIONS[0], town: "", category: "設計旅宿",
  price: 0, guests: 1, image: "", images: [], description: "", amenities: "",
  website: "", line_url: "", embed_urls: [], rooms_left: null, address: "", lat: null, lng: null,
  license_no: "", check_in: "", check_out: "",
  published: false, featured: false, sample: false, ad_tier: "free", save_boost: 0,
};

export interface StayBd { stay_id: string; contacted: boolean; rejected: boolean; note: string | null }
export interface OwnerProfile { id: string; display_name: string | null; full_name: string | null; role: string }
interface LogRow { id: string; actor_name: string | null; action: string; target_type: string | null; target_name: string | null; detail: Record<string, unknown> | null; created_at: string }

type SortKey = "new" | "old" | "name" | "region" | "status" | "tier";
const SORT_LABEL: Record<SortKey, string> = {
  new: "建立時間(新→舊)", old: "建立時間(舊→新)", name: "名稱 A→Z", region: "地區", status: "狀態", tier: "方案(曝光高→低)",
};
const ACTION_LABEL: Record<string, string> = {
  publish: "上架", unpublish: "下架", approve: "核准", reject: "退回審核",
  set_tier: "改方案", delete: "刪除", create: "新增", edit: "編輯",
  pin: "置頂", unpin: "取消置頂", assign_owner: "指派業主", unassign_owner: "收回自管",
  bd_contacted: "標記已聯繫", bd_uncontacted: "取消已聯繫", bd_rejected: "標記拒絕", bd_unrejected: "取消拒絕", bd_note: "改內部備註",
  role_change: "改角色", save: "儲存",
};
const TYPE_LABEL: Record<string, string> = {
  stay: "民宿", room: "房型", vendor: "業者", plan: "方案", site: "首頁設定", member: "會員", place: "景點", rental: "租車",
};

export default function StaysAdmin({ initial, ownerId, bdInitial = [], ownersInitial = [], loadError = null, plans = [] }: {
  initial: Stay[]; ownerId?: string; bdInitial?: StayBd[]; ownersInitial?: OwnerProfile[];
  loadError?: string | null; plans?: Plan[];
}) {
  const planByKey = Object.fromEntries(plans.map((p) => [p.key, p]));
  const planFeatured = (tier?: string | null) => (planByKey[tier || "free"]?.priority ?? 0) > 0; // 付費方案(優先序>0)= 上精選曝光
  const planOptions = plans.length ? plans : [{ key: "free", name: "免費方案", room_pins: 0, priority: 0, sort: 0 }];
  const owners = Object.fromEntries(ownersInitial.map((o) => [o.id, o]));
  const ownerName = (id?: string | null) => {
    if (!id) return null;
    const o = owners[id];
    return o ? (o.display_name || o.full_name || id.slice(0, 8)) : id.slice(0, 8);
  };
  const [list, setList] = useState<Stay[]>(initial);
  // 洽談紀錄存在 stay_bd(只有 admin 讀得到),不放 stays 以免被公開 API 讀走。
  // 業者自己的 /vendor 頁(有 ownerId)不顯示這些內部欄位。
  const isAdminView = !ownerId;
  const [bd, setBd] = useState<Record<string, StayBd>>(
    () => Object.fromEntries(bdInitial.map((b) => [b.stay_id, b])),
  );

  async function saveBd(stayId: string, patch: Partial<StayBd>) {
    const next: StayBd = {
      stay_id: stayId,
      contacted: bd[stayId]?.contacted ?? false,
      rejected: bd[stayId]?.rejected ?? false,
      note: bd[stayId]?.note ?? null,
      ...patch,
    };
    setBd((p) => ({ ...p, [stayId]: next }));          // 先更新畫面
    const sb = createClient();
    const { error } = await sb.from("stay_bd").upsert(next, { onConflict: "stay_id" });
    if (error) {
      alert("洽談紀錄儲存失敗:" + error.message);
      setBd((p) => ({ ...p, [stayId]: { ...next, ...bd[stayId] } }));   // 失敗就還原
      return;
    }
    const sName = list.find((s) => s.id === stayId)?.name;
    if ("contacted" in patch) writeAdminLog(patch.contacted ? "bd_contacted" : "bd_uncontacted", { type: "stay", id: stayId, name: sName });
    else if ("rejected" in patch) writeAdminLog(patch.rejected ? "bd_rejected" : "bd_unrejected", { type: "stay", id: stayId, name: sName });
    else if ("note" in patch) writeAdminLog("bd_note", { type: "stay", id: stayId, name: sName, detail: { note: patch.note } });
  }

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [form, setForm] = useState<Form | null>(null);
  const [assign, setAssign] = useState<Stay | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  // 操作紀錄:共用 helper(lib/admin-log);業者檢視(有 ownerId)不寫。保留原呼叫簽名。
  const logAdmin = (action: string, s: { id?: string; name?: string } | null, detail?: Record<string, unknown>) =>
    isAdminView ? writeAdminLog(action, { type: "stay", id: s?.id ?? null, name: s?.name ?? null, detail: detail ?? null }) : Promise.resolve();

  async function openLogs() {
    setLogOpen(true); setLogs(null);
    const sb = createClient();
    const { data } = await sb.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs((data as LogRow[]) || []);
  }

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

  // 排序:list 本身已是「建立時間新→舊」,其餘各鍵在 filtered 上重排。
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const tierRank = (t?: string | null) => planByKey[t || "free"]?.priority ?? 0;
    const statusRank = (s: Stay) => (s.approved === false ? 0 : s.published ? 2 : 1); // 待審核→草稿→已上架
    const byName = (a: Stay, b: Stay) => a.name.localeCompare(b.name, "zh-Hant");
    switch (sort) {
      case "old": arr.reverse(); break;
      case "name": arr.sort(byName); break;
      case "region": arr.sort((a, b) => (a.region + a.town).localeCompare(b.region + b.town, "zh-Hant") || byName(a, b)); break;
      case "status": arr.sort((a, b) => statusRank(a) - statusRank(b) || byName(a, b)); break;
      case "tier": arr.sort((a, b) => tierRank(b.ad_tier) - tierRank(a.ad_tier) || byName(a, b)); break;
      default: break; // new = 預設
    }
    return arr;
  }, [filtered, sort, planByKey]);

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
      line_url: (form.line_url || "").trim() || null,
      embed_urls: (form.embed_urls || []).map((u) => u.trim()).filter(Boolean),
      rooms_left: form.rooms_left === null || form.rooms_left === undefined || (form.rooms_left as unknown as string) === "" ? null : Number(form.rooms_left),
      address: (form.address || "").trim(),
      lat: form.lat === null || form.lat === undefined || (form.lat as unknown as string) === "" ? null : Number(form.lat),
      lng: form.lng === null || form.lng === undefined || (form.lng as unknown as string) === "" ? null : Number(form.lng),
      license_no: (form.license_no || "").trim() || null,
      check_in: (form.check_in || "").trim() || null,
      check_out: (form.check_out || "").trim() || null,
      published: ownerId ? undefined : form.published, // 上架只有 admin 能設(業者送審)
      featured: ownerId ? undefined : planFeatured(form.ad_tier), sample: ownerId ? undefined : form.sample,
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
    await logAdmin(form.id ? "edit" : "create", { id: newId, name: form.name });
    // 新建後留在編輯狀態,讓下方「房型管理」立刻出現
    setForm((f) => (f ? { ...f, id: newId } : f));
    await refresh();
  }

  async function togglePublish(s: Stay) {
    const sb = createClient();
    await sb.from("stays").update({ published: !s.published }).eq("id", s.id);
    await logAdmin(s.published ? "unpublish" : "publish", s);
    await refresh();
  }
  async function toggleApprove(s: Stay) {
    const sb = createClient();
    await sb.from("stays").update({ approved: !s.approved }).eq("id", s.id);
    await logAdmin(s.approved ? "reject" : "approve", s);
    await refresh();
  }
  async function setTier(s: Stay, ad_tier: string) {
    const sb = createClient();
    await sb.from("stays").update({ ad_tier, featured: planFeatured(ad_tier) }).eq("id", s.id);
    await logAdmin("set_tier", s, { from: s.ad_tier || "free", to: ad_tier });
    await refresh();
  }
  async function remove(s: Stay) {
    if (!confirm(`確定刪除「${s.name}」?此動作無法復原。`)) return;
    const sb = createClient();
    await sb.from("stays").delete().eq("id", s.id);
    await logAdmin("delete", s);
    await refresh();
  }

  return (
    <>
      {loadError && (
        <div className="load-err">
          <b>資料沒有載入成功</b>,下面的數字不是真的。{loadError}
          <button className="btn btn-ghost btn-sm" onClick={() => location.reload()}>重新載入</button>
        </div>
      )}

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
        <select className="sort-sel" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} title="排序" aria-label="排序">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>↕ {SORT_LABEL[k]}</option>)}
        </select>
        {isAdminView && <button className="btn btn-ghost" onClick={openLogs}>🕘 操作紀錄</button>}
        <StaysImport existingNames={list.map((s) => s.name)} onDone={refresh} />
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>＋ 新增民宿</button>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr>
              <th></th><th>名稱</th><th>地區</th><th>風格</th><th>狀態</th>
              {isAdminView && <><th>業主</th><th>洽談</th><th>內部備註</th></>}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={isAdminView ? 9 : 6} className="empty-row">沒有符合的民宿。點「新增民宿」開始上架。</td></tr>}
            {sorted.map((s) => (
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
                {isAdminView && <>
                <td>
                  <button className={"owner-cell" + (s.owner_id ? " on" : "")} onClick={() => setAssign(s)}
                    title={s.owner_id ? "業者自管中,點擊可更換或收回" : "平台自管,點擊指派給業者"}>
                    {s.owner_id ? ownerName(s.owner_id) : "平台自管"}
                  </button>
                </td>
                <td>
                  <div className="bd-checks">
                    <label><input type="checkbox" checked={!!bd[s.id]?.contacted}
                      onChange={(e) => saveBd(s.id, { contacted: e.target.checked })} /> 已聯繫</label>
                    <label><input type="checkbox" checked={!!bd[s.id]?.rejected}
                      onChange={(e) => saveBd(s.id, { rejected: e.target.checked })} /> 拒絕</label>
                  </div>
                </td>
                <td>
                  <input className="bd-note" defaultValue={bd[s.id]?.note || ""}
                    placeholder="聯絡結果、報價…"
                    onBlur={(e) => {
                      if ((bd[s.id]?.note || "") !== e.target.value) saveBd(s.id, { note: e.target.value });
                    }} />
                </td>
                </>}
                <td>
                  <div className="row-actions">
                    <button className="lnk" onClick={() => setForm({ ...s })}>編輯</button>
                    <button className="lnk" onClick={() => togglePublish(s)}>{s.published ? "下架" : "上架"}</button>
                    {!ownerId && <button className="lnk" onClick={() => toggleApprove(s)}>{s.approved ? "退回審核" : "核准"}</button>}
                    {!ownerId && (
                      <select className="tier-sel" value={s.ad_tier || "free"} onChange={(e) => setTier(s, e.target.value)} title="購買方案">
                        {planOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                      </select>
                    )}
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
                <TagPalette settingKey="amenity_options" defaults={AMENITY_OPTIONS} canManage={isAdminView}
                  selected={new Set((form.amenities || "").split("、").map((s) => s.trim()).filter(Boolean))}
                  onToggle={(a) => {
                    const set = new Set((form.amenities || "").split("、").map((s) => s.trim()).filter(Boolean));
                    set.has(a) ? set.delete(a) : set.add(a);
                    setForm({ ...form, amenities: [...set].join("、") });
                  }} />
              </div>
              <div className="wide"><label>封面相簿(可多張,第一張為封面,前台會輪播)</label>
                <MultiImageUploader prefix="stay"
                  value={form.images && form.images.length ? form.images : (form.image ? [form.image] : [])}
                  onChange={(imgs) => setForm({ ...form, images: imgs, image: imgs[0] || "" })} />
              </div>
              <div className="wide"><label>官網 / 訂房連結(導流,選填)</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
              <div className="wide"><label>官方 LINE@(選填)</label><input value={form.line_url || ""} onChange={(e) => setForm({ ...form, line_url: e.target.value })} placeholder="LINE 連結或 @ID,例:https://lin.ee/xxx" /></div>
              <div className="wide"><label>影片介紹 / 網紅推薦(YouTube / IG / TikTok,可多個,一行一個)</label><textarea rows={3} value={(form.embed_urls || []).join("\n")} onChange={(e) => setForm({ ...form, embed_urls: e.target.value.split("\n") })} placeholder={"https://youtu.be/…\nhttps://instagram.com/p/…\nhttps://tiktok.com/@…/video/…"} /></div>
              <div className="wide"><label>介紹</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句話賣點" /></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
              {!ownerId ? (
                <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 店家上架(前台可見)</label>
              ) : (
                <span className="check" style={{ color: form.approved ? "var(--green)" : "var(--text-2)", fontSize: 13.5 }}>
                  {form.id && form.approved ? "✅ 已通過偶宿審核,前台可見" : "⏳ 送出後由偶宿審核,通過後才會在前台公開"}
                </span>
              )}
              {!ownerId && (
                <label className="check" style={{ gap: 6 }}>購買方案
                  <select value={form.ad_tier || "free"} onChange={(e) => setForm({ ...form, ad_tier: e.target.value })} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-strong)" }}>
                    {planOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
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
                <RoomTypesEditor stayId={form.id} stayName={form.name} allowFeatured={!ownerId} canManage={!ownerId} roomPinQuota={planByKey[form.ad_tier || "free"]?.room_pins ?? 0} onChange={() => revalidateStays().catch(() => {})} />
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

      {assign && (
        <StayOwnerAssign
          stayId={assign.id} stayName={assign.name} ownerId={assign.owner_id ?? null}
          onClose={() => setAssign(null)} onDone={refresh}
        />
      )}

      {logOpen && (
        <>
          <div className="overlay" onClick={() => setLogOpen(false)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>操作紀錄 <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>最近 200 筆</span></h2>
            {logs === null ? (
              <p style={{ color: "var(--muted)", padding: "20px 0" }}>載入中…</p>
            ) : logs.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "20px 0" }}>還沒有任何操作紀錄。</p>
            ) : (
              <div className="atable-wrap" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <table className="atable">
                  <thead><tr><th>時間</th><th>操作者</th><th>類別</th><th>動作</th><th>對象</th><th>細節</th></tr></thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{new Date(l.created_at).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                        <td>{l.actor_name || "—"}</td>
                        <td style={{ color: "var(--text-2)" }}>{TYPE_LABEL[l.target_type || ""] || l.target_type || "—"}</td>
                        <td><span className="pill">{ACTION_LABEL[l.action] || l.action}</span></td>
                        <td>{l.target_name || "—"}</td>
                        <td style={{ color: "var(--text-2)", fontSize: 12.5 }}>
                          {l.action === "set_tier" && l.detail
                            ? `${planByKey[l.detail.from as string]?.name || l.detail.from} → ${planByKey[l.detail.to as string]?.name || l.detail.to}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setLogOpen(false)}>關閉</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
