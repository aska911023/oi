"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { revalidateTrips } from "@/app/actions";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { TRANSPORTS, TRIP_ITEM_LABEL, type Trip, type TripItem, type TripItemType } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const genId = () => "t" + Math.random().toString(36).slice(2, 9);

interface PoolItem { id: string; name: string; region: string; town: string; }
type Pools = { stays: PoolItem[]; attractions: PoolItem[]; foods: PoolItem[]; parkings: PoolItem[]; rentals: PoolItem[]; stations: PoolItem[] };

const PICK_TABS: { type: TripItemType; label: string; key: keyof Pools }[] = [
  { type: "stay", label: "住宿", key: "stays" },
  { type: "attraction", label: "景點", key: "attractions" },
  { type: "food", label: "美食", key: "foods" },
  { type: "parking", label: "停車", key: "parkings" },
  { type: "rental", label: "租車", key: "rentals" },
  { type: "station", label: "車站", key: "stations" },
];

export default function TripPlanner({ stays, attractions, foods, parkings, rentals, stations, loggedIn, initial, initialOwned }: Pools & { loggedIn: boolean; initial?: Trip | null; initialOwned?: boolean }) {
  const pools: Pools = useMemo(() => ({ stays, attractions, foods, parkings, rentals, stations }), [stays, attractions, foods, parkings, rentals, stations]);

  const [tripId, setTripId] = useState<string | null>(initial && initialOwned ? initial.id : null);
  const [title, setTitle] = useState(initial ? (initialOwned ? initial.title : initial.title + "(複製)") : "我的行程");
  const [days, setDays] = useState(initial?.days || 2);
  const [headcount, setHeadcount] = useState(initial?.headcount || 2);
  const [budget, setBudget] = useState<string>(initial?.budget != null ? String(initial.budget) : "");
  const [transport, setTransport] = useState<string>(initial?.transport || "開車");
  const [region, setRegion] = useState<string>(initial?.region || "");
  const [summary, setSummary] = useState(initial?.summary || "");
  const [items, setItems] = useState<TripItem[]>(initial?.items?.map((it) => ({ ...it, id: it.id || genId() })) || []);
  const [isPublic, setIsPublic] = useState<boolean>(initialOwned ? !!initial?.is_public : false);
  const [saving, setSaving] = useState(false);

  function copyShareLink() {
    if (!tripId) return;
    const url = `${window.location.origin}/trips/${tripId}`;
    navigator.clipboard?.writeText(url).then(() => alert("分享連結已複製:\n" + url), () => prompt("複製這個連結分享:", url));
  }

  // picker
  const [pickDay, setPickDay] = useState<number | null>(null);
  const [pickTab, setPickTab] = useState<TripItemType>("stay");
  const [pickQ, setPickQ] = useState("");
  const [customName, setCustomName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const dayList = Array.from({ length: days }, (_, i) => i + 1);
  const itemsOfDay = (d: number) => items.filter((it) => it.day === d);

  function addItem(day: number, type: TripItemType, name: string, refId?: string) {
    setItems((p) => [...p, { id: genId(), day, type, name, refId, time: "", note: "" }]);
  }
  function updateItem(id: string, patch: Partial<TripItem>) {
    setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) { setItems((p) => p.filter((it) => it.id !== id)); }

  function copyDayTo(from: number, to: number) {
    if (from === to) return;
    const clones = items.filter((it) => it.day === from).map((it) => ({ ...it, id: genId(), day: to }));
    if (!clones.length) return;
    setItems((p) => [...p, ...clones]);
  }

  const [imgBusy, setImgBusy] = useState<string | null>(null);
  async function uploadItemImage(id: string, file: File) {
    if (!file.type.startsWith("image/")) { alert("請選圖片檔"); return; }
    setImgBusy(id);
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    setImgBusy(null);
    if (error) { alert("上傳失敗:" + error.message); return; }
    updateItem(id, { image: sb.storage.from("site").getPublicUrl(path).data.publicUrl });
  }
  function moveItem(id: string, dir: -1 | 1) {
    setItems((p) => {
      const arr = [...p];
      const idx = arr.findIndex((it) => it.id === id);
      if (idx < 0) return p;
      const day = arr[idx].day;
      // 找同一天的相鄰項
      let j = idx + dir;
      while (j >= 0 && j < arr.length && arr[j].day !== day) j += dir;
      if (j < 0 || j >= arr.length || arr[j].day !== day) return p;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }

  const pickResults = useMemo(() => {
    const tab = PICK_TABS.find((t) => t.type === pickTab);
    if (!tab) return []; // 「自訂」沒有清單
    const pool = pools[tab.key];
    const q = pickQ.trim().toLowerCase();
    return pool.filter((x) => !q || (x.name + x.region + x.town).toLowerCase().includes(q)).slice(0, 60);
  }, [pickTab, pickQ, pools]);

  const isAdded = (day: number, refId: string) => items.some((it) => it.day === day && it.refId === refId);
  function togglePoolItem(day: number, type: TripItemType, name: string, refId: string) {
    setItems((p) => {
      const found = p.find((it) => it.day === day && it.refId === refId);
      if (found) return p.filter((it) => it.id !== found.id);
      return [...p, { id: genId(), day, type, name, refId, time: "", note: "" }];
    });
  }

  function download() {
    const data = { title, days, headcount, budget: budget ? Number(budget) : null, transport, region, summary, items };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "行程"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        setTitle(d.title || "我的行程");
        setDays(Math.min(30, Math.max(1, Number(d.days) || 2)));
        setHeadcount(Number(d.headcount) || 2);
        setBudget(d.budget != null ? String(d.budget) : "");
        setTransport(d.transport || "開車");
        setRegion(d.region || "");
        setSummary(d.summary || "");
        setItems(Array.isArray(d.items) ? d.items.map((it: TripItem) => ({ ...it, id: it.id || genId() })) : []);
        setTripId(null);
        setIsPublic(false);
        alert("已載入行程檔案。");
      } catch {
        alert("檔案格式不正確,請選擇之前從這裡下載的 .json。");
      }
    };
    reader.readAsText(file);
  }

  async function save() {
    if (!loggedIn) { alert("請先登入才能把行程存到帳號(仍可用「下載檔案」保存)。"); return; }
    setSaving(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setSaving(false); alert("登入狀態失效,請重新登入。"); return; }
    const payload = {
      owner_id: user.id, title, days, headcount,
      budget: budget ? Number(budget) : null, transport, region: region || null, summary: summary || null, items,
      is_public: isPublic,
    };
    let error, id = tripId;
    if (tripId) {
      ({ error } = await sb.from("trips").update(payload).eq("id", tripId));
    } else {
      const { data, error: e } = await sb.from("trips").insert(payload).select("id").single();
      error = e; if (data) id = data.id;
    }
    setSaving(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setTripId(id);
    revalidateTrips().catch(() => {}); // 公開行程牆快取失效
    alert("已儲存到你的行程 ✓");
  }

  return (
    <>
      <div className="no-print">
        {/* 基本設定 */}
        <div className="panel plan-basic">
          <div className="pb-grid">
            <div className="wide"><label>行程名稱</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例:墾丁三天兩夜" /></div>
            <div><label>天數</label><input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} /></div>
            <div><label>人數</label><input type="number" min={1} max={99} value={headcount} onChange={(e) => setHeadcount(Math.max(1, Number(e.target.value) || 1))} /></div>
            <div><label>每人預算(選填)</label><input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="NT$" /></div>
            <div><label>交通方式</label><select value={transport} onChange={(e) => setTransport(e.target.value)}>{TRANSPORTS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label>主要地區(選填)</label><select value={region} onChange={(e) => setRegion(e.target.value)}><option value="">不指定</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div className="wide"><label>行程簡介(選填)</label><input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="一句話描述這趟旅程" /></div>
          </div>
        </div>

        {/* 每日時間軸 */}
        <div className="plan-days">
          {dayList.map((d) => (
            <div className="day-card" key={d}>
              <div className="day-head">
                <b>Day {d}</b>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {days > 1 && itemsOfDay(d).length > 0 && (
                    <select className="day-copy" value="" onChange={(e) => { const to = Number(e.target.value); if (to) copyDayTo(d, to); e.currentTarget.value = ""; }}>
                      <option value="">複製到…</option>
                      {dayList.filter((x) => x !== d).map((x) => <option key={x} value={x}>Day {x}</option>)}
                    </select>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPickDay(d); setPickTab("stay"); setPickQ(""); setCustomName(""); }}>＋ 加入</button>
                </div>
              </div>
              {itemsOfDay(d).length === 0 && <div className="day-empty">還沒有安排,點「加入」把住宿 / 景點 / 美食 / 停車排進來。</div>}
              <div className="day-items">
                {itemsOfDay(d).map((it) => (
                  <div className="trip-item" key={it.id}>
                    <input className="ti-time" type="time" value={it.time || ""} onChange={(e) => updateItem(it.id, { time: e.target.value })} />
                    <span className={"ti-type ti-" + it.type}>{TRIP_ITEM_LABEL[it.type]}</span>
                    <div className="ti-main">
                      <div className="ti-name">{it.name}</div>
                      <input className="ti-note" value={it.note || ""} onChange={(e) => updateItem(it.id, { note: e.target.value })} placeholder="備註(選填)" />
                      <div className="ti-photo">
                        {it.image && <img src={it.image} alt="" />}
                        <label className="lnk" style={{ cursor: "pointer" }}>
                          {imgBusy === it.id ? "上傳中…" : it.image ? "換照片" : "＋ 照片"}
                          <input type="file" accept="image/*" style={{ display: "none" }} disabled={imgBusy !== null}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadItemImage(it.id, f); e.target.value = ""; }} />
                        </label>
                        {it.image && <button className="lnk danger" onClick={() => updateItem(it.id, { image: "" })}>移除</button>}
                      </div>
                    </div>
                    <div className="ti-actions">
                      <button className="lnk" onClick={() => moveItem(it.id, -1)}>↑</button>
                      <button className="lnk" onClick={() => moveItem(it.id, 1)}>↓</button>
                      <button className="lnk danger" onClick={() => removeItem(it.id)}>刪</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 分享設定 */}
        {loggedIn && (
          <div className="plan-share">
            <label className="check"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> 公開到「行程分享牆」讓大家參考</label>
            {tripId && isPublic && <button className="lnk" onClick={copyShareLink}>複製分享連結</button>}
          </div>
        )}

        {/* 動作列 */}
        <div className="plan-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "儲存中…" : tripId ? "更新行程" : "儲存到我的行程"}</button>
          <button className="btn btn-ghost" onClick={download}>下載檔案(.json)</button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>匯入檔案</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>列印 / 存 PDF</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
        </div>
        {!loggedIn && <p className="plan-hint">未登入也能規劃並「下載檔案」與旅伴互傳;登入後可存到帳號、公開分享。</p>}
      </div>

      {/* 列印用版面 */}
      <div className="trip-print">
        <h1>{title}</h1>
        <p className="tp-meta">{days} 天 · {headcount} 人 · 交通:{transport}{budget ? ` · 每人預算 NT$${budget}` : ""}{region ? ` · ${region}` : ""}</p>
        {summary && <p className="tp-summary">{summary}</p>}
        {dayList.map((d) => (
          <div className="tp-day" key={d}>
            <h2>Day {d}</h2>
            {itemsOfDay(d).length === 0 ? <p className="tp-empty">(未安排)</p> : (
              <ul>
                {itemsOfDay(d).map((it) => (
                  <li key={it.id}>
                    <span className="tp-time">{it.time || "—"}</span> [{TRIP_ITEM_LABEL[it.type]}] {it.name}{it.note ? ` — ${it.note}` : ""}
                    {it.image && <img className="tp-img" src={it.image} alt="" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <p className="tp-foot">由 偶宿 O! 行程規劃工具產生</p>
      </div>

      {/* 加入項目 picker */}
      {pickDay != null && (
        <>
          <div className="overlay no-print" onClick={() => setPickDay(null)} />
          <div className="editor no-print" role="dialog" aria-modal="true">
            <h2>Day {pickDay} · 加入項目</h2>
            <p className="pick-tip">可以連續點選加入多個(再點一下取消);「自訂」用來手動加清單裡沒有的項目。加完按「完成」。</p>
            <div className="seg" style={{ marginBottom: 12 }}>
              {PICK_TABS.map((t) => <button key={t.type} className={pickTab === t.type ? "on" : ""} onClick={() => setPickTab(t.type)}>{t.label}</button>)}
              <button className={pickTab === "note" ? "on" : ""} onClick={() => setPickTab("note")}>自訂</button>
            </div>

            {pickTab === "note" ? (
              <div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="自訂項目,例:海邊看日落、休息站、加油"
                    onKeyDown={(e) => { if (e.key === "Enter" && customName.trim()) { addItem(pickDay, "note", customName.trim()); setCustomName(""); } }} style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={() => { if (customName.trim()) { addItem(pickDay, "note", customName.trim()); setCustomName(""); } }}>加入</button>
                </div>
                <p className="pick-tip" style={{ marginTop: 8 }}>輸入後按「加入」或 Enter,可一直加。</p>
              </div>
            ) : (
              <>
                <input className="admin-search" value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="搜尋名稱、地區…" style={{ width: "100%", marginBottom: 10 }} />
                <div className="pick-list">
                  {pickResults.length === 0 && <div className="day-empty">找不到,或這個分類還沒有資料。可切到「自訂」手動加。</div>}
                  {pickResults.map((x) => {
                    const added = isAdded(pickDay, x.id);
                    return (
                      <button key={x.id} className={"pick-row" + (added ? " added" : "")} onClick={() => togglePoolItem(pickDay, pickTab, x.name, x.id)}>
                        <span className="pick-check">{added ? "✓" : "＋"}</span>
                        <span className="pick-nm">{x.name}</span>
                        <small>{x.region}{x.town ? " · " + x.town : ""}</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="editor-actions">
              <span style={{ marginRight: "auto", fontSize: 13, color: "var(--text-2)" }}>Day {pickDay} 已排 {itemsOfDay(pickDay).length} 項</span>
              <button className="btn btn-primary" onClick={() => setPickDay(null)}>完成</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
