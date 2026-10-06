"use client";

import { useMemo, useState } from "react";

export interface Vendor {
  id: string; owner_id: string; business_name: string;
  phone?: string | null; email?: string | null; address?: string | null;
  website?: string | null; line_url?: string | null; fb_url?: string | null; ig_url?: string | null;
  created_at: string;
}
export interface OwnedStay {
  id: string; name: string; region?: string | null; town?: string | null; owner_id: string;
  published?: boolean | null; visibility?: string | null; featured?: boolean | null; ad_tier?: string | null; approved?: boolean | null;
  image?: string | null; category?: string | null; price?: number | null;
}

const TIER_LABEL: Record<string, string> = { featured: "精選", flagship: "旗艦" };
const isLive = (s: OwnedStay) => !!s.published && s.visibility === "published" && s.approved !== false;
const isPending = (s: OwnedStay) => s.approved === false;

export default function PartnersBoard({ vendors, stays }: { vendors: Vendor[]; stays: OwnedStay[] }) {
  const [kw, setKw] = useState("");
  const [view, setView] = useState<Vendor | null>(null);

  const byOwner = useMemo(() => {
    const m: Record<string, OwnedStay[]> = {};
    for (const s of stays) { (m[s.owner_id] ||= []).push(s); }
    return m;
  }, [stays]);

  const rows = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return vendors.filter((v) => !q || v.business_name.toLowerCase().includes(q) || (v.phone || "").includes(q) || (v.email || "").toLowerCase().includes(q));
  }, [vendors, kw]);

  const cnt = (v: Vendor, f: (s: OwnedStay) => boolean) => (byOwner[v.owner_id] || []).filter(f).length;
  const links = (v: Vendor) => (
    <>
      {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer">官網</a>}
      {v.line_url && <span className="plink">LINE</span>}
      {v.fb_url && <a href={v.fb_url} target="_blank" rel="noopener noreferrer">FB</a>}
      {v.ig_url && <a href={v.ig_url} target="_blank" rel="noopener noreferrer">IG</a>}
      {!v.website && !v.line_url && !v.fb_url && !v.ig_url && "—"}
    </>
  );

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 16px" }}>
        業者(業主)資訊 · 一個業主可綁多間民宿、一間民宿只屬於一個業主。點「詳情」看業主資料與旗下民宿。
      </p>

      <div className="stats">
        <div className="stat-card"><div className="n">{vendors.length}</div><div className="l">業主總數</div></div>
        <div className="stat-card"><div className="n">{stays.length}</div><div className="l">已綁定民宿</div></div>
        <div className="stat-card"><div className="n">{stays.filter(isLive).length}</div><div className="l">已公開民宿</div></div>
        <div className="stat-card"><div className="n">{stays.filter(isPending).length}</div><div className="l">待審核民宿</div></div>
      </div>

      <div className="admin-bar">
        <input className="admin-search" placeholder="搜尋業主名稱 / 電話 / Email" value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>

      <div className="atable-wrap">
        <table className="atable">
          <thead>
            <tr><th>業主</th><th>電話</th><th>Email</th><th>官方連結</th><th>民宿</th><th>已公開</th><th>待審</th><th>操作</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty-row">目前沒有業者。會員通過「業者審核」後會出現在這裡。</td></tr>}
            {rows.map((v) => (
              <tr key={v.id}>
                <td><b>{v.business_name}</b></td>
                <td style={{ whiteSpace: "nowrap" }}>{v.phone || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{v.email || "—"}</td>
                <td className="vendor-links">{links(v)}</td>
                <td><b>{cnt(v, () => true)}</b> 間</td>
                <td>{cnt(v, isLive) || "—"}</td>
                <td>{cnt(v, isPending) ? <span className="pill pending">{cnt(v, isPending)}</span> : "—"}</td>
                <td><button className="lnk" onClick={() => setView(v)}>詳情</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view && (
        <>
          <div className="overlay" onClick={() => setView(null)} />
          <div className="editor" role="dialog" aria-modal="true">
            <h2>{view.business_name}</h2>
            <dl className="kv">
              <div><dt>電話</dt><dd>{view.phone || "—"}</dd></div>
              <div><dt>Email</dt><dd>{view.email || "—"}</dd></div>
              <div><dt>地址</dt><dd>{view.address || "—"}</dd></div>
              <div><dt>官網</dt><dd>{view.website ? <a href={view.website} target="_blank" rel="noopener noreferrer">{view.website}</a> : "—"}</dd></div>
              <div><dt>官方 LINE</dt><dd>{view.line_url || "—"}</dd></div>
              <div><dt>官方 FB</dt><dd>{view.fb_url ? <a href={view.fb_url} target="_blank" rel="noopener noreferrer">{view.fb_url}</a> : "—"}</dd></div>
              <div><dt>官方 IG</dt><dd>{view.ig_url ? <a href={view.ig_url} target="_blank" rel="noopener noreferrer">{view.ig_url}</a> : "—"}</dd></div>
            </dl>

            <h3 className="room-list-h" style={{ marginTop: 18 }}>旗下民宿 <span className="count">{(byOwner[view.owner_id] || []).length} 間</span></h3>
            <div className="atable-wrap" style={{ marginTop: 8 }}>
              <table className="atable">
                <thead><tr><th></th><th>民宿</th><th>類型</th><th>地區</th><th>起價</th><th>曝光</th><th>狀態</th><th>操作</th></tr></thead>
                <tbody>
                  {(byOwner[view.owner_id] || []).length === 0 && <tr><td colSpan={8} className="empty-row">尚未綁定民宿。</td></tr>}
                  {(byOwner[view.owner_id] || []).map((s) => (
                    <tr key={s.id}>
                      <td>{s.image ? <img className="athumb" src={s.image} alt="" /> : <div className="athumb" />}</td>
                      <td><b>{s.name}</b></td>
                      <td style={{ whiteSpace: "nowrap" }}>{s.category || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{s.region || ""}{s.town ? "・" + s.town : ""}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{s.price ? `$${s.price.toLocaleString()}` : "—"}</td>
                      <td>{s.ad_tier && s.ad_tier !== "free" ? <span className="pill feat">{TIER_LABEL[s.ad_tier] || s.ad_tier}</span> : "一般"}</td>
                      <td>{isPending(s) ? <span className="pill pending">待審核</span> : <span className={"pill " + (isLive(s) ? "live" : "draft")}>{isLive(s) ? "已公開" : "未公開"}</span>}</td>
                      <td><a className="lnk" href={`/stay/${s.id}`} target="_blank" rel="noopener noreferrer">查看</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="editor-actions">
              <button className="btn btn-primary" onClick={() => setView(null)}>關閉</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
