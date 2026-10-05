"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Lead {
  id: string;
  kind: string;
  code: string | null;
  name: string;
  county: string | null;
  area: string | null;
  town: string | null;
  address: string | null;
  category: string | null;
  theme: string | null;
  priority: string | null;
  status: string;
  guests_min: number | null;
  guests_max: number | null;
  guests_ambiguous: boolean;
  price_from: number | null;
  price_note: string | null;
  room_note: string | null;
  whole_house: string | null;
  parking: string | null;
  phone: string | null;
  line_id: string | null;
  website: string | null;
  license_no: string | null;
  summary: string | null;
  contact_note: string | null;
  description: string | null;
  open_note: string | null;
  photo_status: string | null;
  photo_urls: string[] | null;
  source_doc: string | null;
  checked_on: string | null;
  owner_note: string | null;
  contacted_at: string | null;
}

const STATUSES = ["候選", "已聯絡", "洽談中", "已簽約", "婉拒", "暫不處理"];
// 狀態 → 既有 pill 樣式
const STATUS_PILL: Record<string, string> = {
  候選: "draft", 已聯絡: "pending", 洽談中: "feat",
  已簽約: "approved", 婉拒: "rejected", 暫不處理: "role-user",
};

const guestText = (l: Lead) => {
  if (!l.guests_max) return "—";
  if (l.guests_min && l.guests_min !== l.guests_max) return `${l.guests_min}–${l.guests_max} 人`;
  return `${l.guests_max} 人`;
};

export default function LeadsBoard({ initial }: { initial: Lead[] }) {
  const [list, setList] = useState<Lead[]>(initial);
  const [kind, setKind] = useState("stay");
  const [county, setCounty] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [kw, setKw] = useState("");
  const [view, setView] = useState<Lead | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [busy, setBusy] = useState(false);

  const counties = useMemo(
    () => Array.from(new Set(list.filter((l) => l.kind === kind).map((l) => l.county).filter(Boolean))) as string[],
    [list, kind],
  );

  const rows = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return list.filter((l) =>
      l.kind === kind &&
      (!county || l.county === county) &&
      (!priority || l.priority === priority) &&
      (!status || l.status === status) &&
      (!q ||
        l.name.toLowerCase().includes(q) ||
        (l.town || "").toLowerCase().includes(q) ||
        (l.theme || "").toLowerCase().includes(q) ||
        (l.category || "").toLowerCase().includes(q) ||
        (l.address || "").toLowerCase().includes(q)),
    );
  }, [list, kind, county, priority, status, kw]);

  const scope = list.filter((l) => l.kind === kind);

  function open(l: Lead) {
    setView(l);
    setDraftStatus(l.status);
    setDraftNote(l.owner_note || "");
  }

  async function save() {
    if (!view) return;
    setBusy(true);
    const patch: Record<string, unknown> = { status: draftStatus, owner_note: draftNote || null };
    // 第一次標記為已聯絡時留下時間
    if (draftStatus !== "候選" && !view.contacted_at) patch.contacted_at = new Date().toISOString();
    const sb = createClient();
    const { error } = await sb.from("leads").update(patch).eq("id", view.id);
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setList((prev) => prev.map((l) => (l.id === view.id ? { ...l, ...(patch as Partial<Lead>) } : l)));
    setView(null);
  }

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 16px" }}>
        公開資料初選的待洽談名單,<b>尚未聯絡、尚未取得圖文授權</b>,與正式上架資料分開存放。談成後再建立正式民宿資料。
      </p>

      <div className="stats">
        <div className="stat-card"><div className="n">{scope.length}</div><div className="l">{kind === "stay" ? "民宿候選" : "景點候選"}</div></div>
        <div className="stat-card"><div className="n">{scope.filter((l) => l.priority === "A").length}</div><div className="l">A 級優先洽談</div></div>
        <div className="stat-card"><div className="n">{scope.filter((l) => l.status !== "候選").length}</div><div className="l">已進入洽談</div></div>
        <div className="stat-card"><div className="n">{scope.filter((l) => l.guests_ambiguous).length}</div><div className="l">人數待人工確認</div></div>
      </div>

      <div className="admin-subtabs" style={{ marginTop: 0 }}>
        {[{ k: "stay", t: "民宿" }, { k: "attraction", t: "景點・活動" }].map((x) => (
          <a key={x.k} href="#" className={kind === x.k ? "on" : ""}
            onClick={(e) => { e.preventDefault(); setKind(x.k); setCounty(""); }}>
            {x.t} {list.filter((l) => l.kind === x.k).length}
          </a>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "0 0 18px" }}>
        <input className="lead-f" placeholder="搜尋名稱 / 鄉鎮 / 主題" value={kw} onChange={(e) => setKw(e.target.value)} />
        <select className="lead-f" value={county} onChange={(e) => setCounty(e.target.value)}>
          <option value="">全部縣市</option>
          {counties.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {kind === "stay" && (
          <select className="lead-f" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">全部分級</option>
            <option value="A">A 優先洽談</option>
            <option value="B">B 補資料</option>
          </select>
        )}
        <select className="lead-f" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部狀態</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr>
              <th>名稱</th><th>地區</th>
              <th>{kind === "stay" ? "主題" : "分類"}</th>
              {kind === "stay" && <><th>人數</th><th>參考價</th></>}
              <th>聯絡</th><th>分級</th><th>狀態</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={kind === "stay" ? 9 : 7} className="empty-row">沒有符合條件的名單。</td></tr>}
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  <b>{l.name}</b>
                  {l.code && <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>{l.code}</span>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {l.county}{l.area ? `・${l.area}` : ""}{l.town ? `・${l.town}` : ""}
                </td>
                <td>{l.kind === "stay" ? (l.theme || "—") : [l.category, l.theme].filter(Boolean).join("・")}</td>
                {kind === "stay" && (
                  <>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {guestText(l)}
                      {l.guests_ambiguous && <span title="原文只有單一數字,待確認" style={{ color: "#9a6a1a", marginLeft: 4 }}>⚠</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{l.price_from ? `$${l.price_from.toLocaleString()}` : "待詢"}</td>
                  </>
                )}
                <td style={{ whiteSpace: "nowrap" }}>{l.phone || l.line_id || "—"}</td>
                <td>{l.priority ? <span className={"pill " + (l.priority === "A" ? "live" : "draft")}>{l.priority}</span> : "—"}</td>
                <td><span className={"pill " + (STATUS_PILL[l.status] || "draft")}>{l.status}</span></td>
                <td><button className="lnk" onClick={() => open(l)}>詳情</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view && (
        <>
          <div className="overlay" onClick={() => setView(null)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{view.name}</h2>
            <dl className="kv">
              <div><dt>地區</dt><dd>{[view.county, view.area, view.town].filter(Boolean).join("・") || "—"}</dd></div>
              <div><dt>地址</dt><dd>{view.address || "— (原始名單未載明門牌)"}</dd></div>
              {view.kind === "stay" ? (
                <>
                  <div><dt>主題</dt><dd>{view.theme || "—"}</dd></div>
                  <div><dt>包棟人數</dt><dd>{guestText(view)}{view.guests_ambiguous && " ⚠ 原文僅單一數字,請確認是否為區間"}</dd></div>
                  <div><dt>參考價</dt><dd>{view.price_note || (view.price_from ? `$${view.price_from.toLocaleString()} 起` : "待詢")}</dd></div>
                  {view.room_note && <div><dt>房型</dt><dd>{view.room_note}</dd></div>}
                  {view.whole_house && <div><dt>可否包棟</dt><dd>{view.whole_house}</dd></div>}
                  {view.parking && <div><dt>可否停車</dt><dd>{view.parking}</dd></div>}
                  {view.license_no && <div><dt>登記號線索</dt><dd>{view.license_no}</dd></div>}
                </>
              ) : (
                <>
                  <div><dt>分類</dt><dd>{[view.category, view.theme].filter(Boolean).join("・") || "—"}</dd></div>
                  {view.open_note && <div><dt>開放提醒</dt><dd>{view.open_note}</dd></div>}
                </>
              )}
              <div><dt>電話</dt><dd>{view.phone || "—"}</dd></div>
              <div><dt>LINE</dt><dd>{view.line_id || "—"}</dd></div>
              <div><dt>官網</dt><dd>{view.website ? <a href={view.website} target="_blank" rel="noopener noreferrer">{view.website}</a> : "—"}</dd></div>
              {view.summary && <div><dt>選店理由</dt><dd>{view.summary}</dd></div>}
              {view.contact_note && <div><dt>查核提醒</dt><dd>{view.contact_note}</dd></div>}
              {view.description && <div><dt>介紹草稿</dt><dd>{view.description}</dd></div>}
              {view.photo_status && <div><dt>照片授權</dt><dd>{view.photo_status}</dd></div>}
              {view.photo_urls && view.photo_urls.length > 0 && (
                <div>
                  <dt>照片候選</dt>
                  <dd>{view.photo_urls.map((u, i) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ marginRight: 10 }}>圖{i + 1}</a>
                  ))}</dd>
                </div>
              )}
              <div><dt>資料來源</dt><dd>{view.source_doc}{view.checked_on ? `(查核 ${view.checked_on})` : ""}</dd></div>
            </dl>

            <div className="field" style={{ marginTop: 20 }}>
              <label>洽談狀態</label>
              <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>洽談備註</label>
              <textarea rows={3} value={draftNote} onChange={(e) => setDraftNote(e.target.value)}
                placeholder="聯絡結果、報價、可用照片、下次追蹤時間…" />
            </div>

            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => setView(null)}>關閉</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "儲存中…" : "儲存"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
