"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { revalidateTrips } from "@/app/actions";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { TRANSPORTS, TRIP_ITEM_LABEL, type Trip, type TripItem, type TripItemType } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const genId = () => "t" + Math.random().toString(36).slice(2, 9);

interface PoolItem { id: string; name: string; region: string; town: string; stayId?: string; }
type Pools = { stays: PoolItem[]; rooms: PoolItem[]; attractions: PoolItem[]; foods: PoolItem[]; parkings: PoolItem[]; rentals: PoolItem[]; stations: PoolItem[] };

// 住宿改成用「房型」清單(key: rooms);其餘不變
const PICK_TABS: { type: TripItemType; label: string; key: keyof Pools }[] = [
  { type: "stay", label: "住宿", key: "rooms" },
  { type: "attraction", label: "景點", key: "attractions" },
  { type: "food", label: "美食", key: "foods" },
  { type: "parking", label: "停車", key: "parkings" },
  { type: "rental", label: "租車", key: "rentals" },
  { type: "station", label: "車站", key: "stations" },
];

export default function TripPlanner({ stays, rooms, attractions, foods, parkings, rentals, stations, loggedIn, initial, initialOwned }: Pools & { loggedIn: boolean; initial?: Trip | null; initialOwned?: boolean }) {
  const pools: Pools = useMemo(() => ({ stays, rooms, attractions, foods, parkings, rentals, stations }), [stays, rooms, attractions, foods, parkings, rentals, stations]);

  const [tripId, setTripId] = useState<string | null>(initial && initialOwned ? initial.id : null);
  const [title, setTitle] = useState(initial ? (initialOwned ? initial.title : initial.title + "(複製)") : "我的行程");
  const [days, setDays] = useState(initial?.days || 2);
  const [nights, setNights] = useState(initial?.nights ?? Math.max(0, (initial?.days || 2) - 1));
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
  const [pickSlot, setPickSlot] = useState<"day" | "night">("day");
  const [stationSys, setStationSys] = useState<"hsr" | "tra">("hsr");
  const [pickTab, setPickTab] = useState<TripItemType>("attraction");
  const [pickQ, setPickQ] = useState("");
  const [customName, setCustomName] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // 載入「我的收藏」(民宿 saved + 景點/美食/停車/租車 saved_places),planner 可只看收藏的
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !alive) return;
      const [sp, sv] = await Promise.all([
        sb.from("saved_places").select("kind, place_id").eq("user_id", user.id),
        sb.from("saved").select("stay_id").eq("user_id", user.id),
      ]);
      if (!alive) return;
      const s = new Set<string>();
      (sp.data as { kind: string; place_id: string }[] | null)?.forEach((r) => s.add(`${r.kind}:${r.place_id}`));
      (sv.data as { stay_id: string }[] | null)?.forEach((r) => s.add(`stay:${r.stay_id}`));
      setSavedSet(s);
    })();
    return () => { alive = false; };
  }, [loggedIn]);

  const dayList = Array.from({ length: days }, (_, i) => i + 1);
  const defaultSlot = (t: TripItemType): "day" | "night" => (t === "stay" ? "night" : "day");
  const itemsOfDay = (d: number) => items.filter((it) => it.day === d);
  const slotItems = (d: number, slot: "day" | "night") => items.filter((it) => it.day === d && (it.slot || defaultSlot(it.type)) === slot);

  function openPicker(day: number, slot: "day" | "night") {
    setPickDay(day); setPickSlot(slot); setPickQ(""); setCustomName("");
    setPickTab(slot === "night" ? "stay" : "attraction");
  }

  function addItem(day: number, type: TripItemType, name: string, refId: string | undefined, slot: "day" | "night") {
    setItems((p) => [...p, { id: genId(), day, type, name, refId, time: "", note: "", slot }]);
  }
  function updateItem(id: string, patch: Partial<TripItem>) {
    setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) { setItems((p) => p.filter((it) => it.id !== id)); }

  // 單一項目複製到別天(保留白天/晚上分段)
  function copyItemTo(item: TripItem, toDay: number) {
    setItems((p) => [...p, { ...item, id: genId(), day: toDay, slot: item.slot || defaultSlot(item.type) }]);
  }

  // 拖拉換順序(拖到某項就插到它前面,並跟隨它的天/時段)
  const dragId = useRef<string | null>(null);
  function dropOn(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    setItems((p) => {
      const fi = p.findIndex((x) => x.id === from);
      const ti = p.findIndex((x) => x.id === targetId);
      if (fi < 0 || ti < 0) return p;
      const target = p[ti];
      const arr = [...p];
      const [moved] = arr.splice(fi, 1);
      moved.day = target.day;
      moved.slot = target.slot || defaultSlot(target.type);
      const ni = arr.findIndex((x) => x.id === targetId);
      arr.splice(ni, 0, moved);
      return arr;
    });
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

  const pickResults = useMemo(() => {
    const tab = PICK_TABS.find((t) => t.type === pickTab);
    if (!tab) return []; // 「自訂」沒有清單
    let pool = pools[tab.key];
    if (pickTab === "station") pool = pool.filter((x) => x.name.startsWith(stationSys === "hsr" ? "高鐵" : "台鐵"));
    if (savedOnly) { const kind = pickTab === "stay" ? "room" : pickTab; pool = pool.filter((x) => savedSet.has(`${kind}:${x.id}`)); }
    const q = pickQ.trim().toLowerCase();
    return pool.filter((x) => !q || (x.name + x.region + x.town).toLowerCase().includes(q)).slice(0, 60);
  }, [pickTab, pickQ, pools, stationSys, savedOnly, savedSet]);

  const isAdded = (day: number, refId: string) => items.some((it) => it.day === day && it.refId === refId && !it.roomId);
  const isAddedRoom = (day: number, roomId: string) => items.some((it) => it.day === day && it.roomId === roomId);
  function togglePoolItem(day: number, type: TripItemType, name: string, refId: string, slot: "day" | "night", roomId?: string) {
    setItems((p) => {
      const found = roomId
        ? p.find((it) => it.day === day && it.roomId === roomId)
        : p.find((it) => it.day === day && it.refId === refId && !it.roomId);
      if (found) return p.filter((it) => it.id !== found.id);
      return [...p, { id: genId(), day, type, name, refId, roomId, time: "", note: "", slot }];
    });
  }

  function download() {
    const data = { title, days, nights, headcount, budget: budget ? Number(budget) : null, transport, region, summary, items };
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
        setNights(Math.max(0, Number(d.nights) ?? 1));
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
      owner_id: user.id, title, days, nights, headcount,
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
            <div><label>天數</label><input type="number" min={1} max={30} value={days} onChange={(e) => { const dv = Math.min(30, Math.max(1, Number(e.target.value) || 1)); setDays(dv); if (nights > dv) setNights(dv); }} /></div>
            <div><label>夜數(最後一天不住宿)</label><input type="number" min={0} max={days} value={nights} onChange={(e) => setNights(Math.min(days, Math.max(0, Number(e.target.value) || 0)))} /></div>
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
              <div className="day-head"><b>Day {d}</b></div>
              {(["day", "night"] as const).map((slot) => (slot === "night" && d > nights) ? null : (
                <div className="day-slot" key={slot}>
                  <div className="slot-head">
                    <span className="slot-title">{slot === "day" ? "☀ 白天 · 景點 / 美食 / 停車 / 租車" : "🌙 晚上 · 住宿"}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => openPicker(d, slot)}>＋ 加入{slot === "night" ? "住宿" : ""}</button>
                  </div>
                  {slotItems(d, slot).length === 0 && <div className="day-empty">{slot === "day" ? "排入景點、美食、停車、租車、車站…" : "排入這天要住的民宿"}</div>}
                  <div className="day-items">
                    {slotItems(d, slot).map((it) => (
                      <div className="trip-item" key={it.id} draggable
                        onDragStart={() => { dragId.current = it.id; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropOn(it.id)}>
                        <span className="ti-grip" title="拖拉換順序">⠿</span>
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
                          {days > 1 && (
                            <select className="ti-copy" value="" onChange={(e) => { const to = Number(e.target.value); if (to) copyItemTo(it, to); e.currentTarget.value = ""; }} title="複製這一項到別天">
                              <option value="">複製到…</option>
                              {dayList.filter((x) => x !== d).map((x) => <option key={x} value={x}>Day {x}</option>)}
                            </select>
                          )}
                          <button className="lnk danger" onClick={() => removeItem(it.id)}>刪</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
            <h2>Day {pickDay} · 加入{pickSlot === "night" ? "住宿(晚上)" : "白天行程"}</h2>
            <p className="pick-tip">可以連續點選加入多個(再點一下取消)。加完按「完成」。</p>
            <div className="seg" style={{ marginBottom: 12 }}>
              {PICK_TABS.filter((t) => (pickSlot === "night" ? t.type === "stay" : t.type !== "stay")).map((t) => <button key={t.type} className={pickTab === t.type ? "on" : ""} onClick={() => setPickTab(t.type)}>{t.label}</button>)}
              <button className={pickTab === "note" ? "on" : ""} onClick={() => setPickTab("note")}>自訂</button>
            </div>

            {pickTab === "note" ? (
              <div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="自訂項目,例:海邊看日落、休息站、加油"
                    onKeyDown={(e) => { if (e.key === "Enter" && customName.trim()) { addItem(pickDay, "note", customName.trim(), undefined, pickSlot); setCustomName(""); } }} style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={() => { if (customName.trim()) { addItem(pickDay, "note", customName.trim(), undefined, pickSlot); setCustomName(""); } }}>加入</button>
                </div>
                <p className="pick-tip" style={{ marginTop: 8 }}>輸入後按「加入」或 Enter,可一直加。</p>
              </div>
            ) : (
              <>
                {pickTab === "station" && (
                  <div className="seg" style={{ marginBottom: 10 }}>
                    <button className={stationSys === "hsr" ? "on" : ""} onClick={() => setStationSys("hsr")}>高鐵</button>
                    <button className={stationSys === "tra" ? "on" : ""} onClick={() => setStationSys("tra")}>台鐵</button>
                  </div>
                )}
                <div className="pick-filterbar">
                  <input className="admin-search" value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="搜尋名稱、地區…" style={{ flex: 1 }} />
                  {loggedIn && (
                    <button type="button" className={"chip" + (savedOnly ? " on" : "")} onClick={() => setSavedOnly((v) => !v)} title="先去逛一圈、點書籤收藏,再回來這裡安排">
                      ♥ 我的收藏
                    </button>
                  )}
                </div>
                <div className="pick-list">
                  {pickResults.length === 0 && <div className="day-empty">{savedOnly ? "這個分類還沒有收藏。逛探索頁點圖片上的書籤收藏,再回來安排。" : "找不到,或這個分類還沒有資料。可切到「自訂」手動加。"}</div>}
                  {pickResults.map((x) => {
                    const isRoom = pickTab === "stay";
                    const refId = isRoom ? (x.stayId || x.id) : x.id;
                    const roomId = isRoom ? x.id : undefined;
                    const added = isRoom ? isAddedRoom(pickDay, x.id) : isAdded(pickDay, x.id);
                    return (
                      <button key={x.id} className={"pick-row" + (added ? " added" : "")} onClick={() => togglePoolItem(pickDay, pickTab, x.name, refId, pickSlot, roomId)}>
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
              <button className="btn btn-primary" onClick={() => setPickDay(null)}>完成</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
