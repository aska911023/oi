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
  published?: boolean | null; visibility?: string | null; featured?: boolean | null; ad_tier?: string | null;
}

const TIER_LABEL: Record<string, string> = { featured: "精選", flagship: "旗艦" };

export default function PartnersBoard({ vendors, stays }: { vendors: Vendor[]; stays: OwnedStay[] }) {
  const [kw, setKw] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const byOwner = useMemo(() => {
    const m: Record<string, OwnedStay[]> = {};
    for (const s of stays) { (m[s.owner_id] ||= []).push(s); }
    return m;
  }, [stays]);

  const filtered = vendors.filter((v) => !kw.trim() || v.business_name.includes(kw.trim()) || (v.phone || "").includes(kw.trim()));

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 14px" }}>
        業者(業主)資訊 · 一個業主可綁多間民宿、一間民宿只屬於一個業主。共 <b>{vendors.length}</b> 位業主 · <b>{stays.length}</b> 間已綁定民宿。
      </p>
      <div className="admin-bar">
        <input className="admin-search" placeholder="搜尋業主名稱 / 電話" value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>

      {filtered.length === 0 && (
        <div className="empty" style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
          目前沒有業者。會員通過「業者審核」後會出現在這裡。
        </div>
      )}

      {filtered.map((v) => {
        const list = byOwner[v.owner_id] || [];
        const isOpen = !!open[v.id];
        return (
          <div className="vendor-card" key={v.id}>
            <button type="button" className="vendor-head" onClick={() => setOpen((p) => ({ ...p, [v.id]: !p[v.id] }))}>
              <div className="vendor-main">
                <b>{v.business_name}</b>
                <div className="vendor-contacts">
                  {v.phone && <span>📞 {v.phone}</span>}
                  {v.email && <span>✉ {v.email}</span>}
                  {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>官網</a>}
                  {v.line_url && <span>LINE</span>}
                  {v.fb_url && <a href={v.fb_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>FB</a>}
                  {v.ig_url && <a href={v.ig_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>IG</a>}
                </div>
              </div>
              <div className="vendor-count"><b>{list.length}</b> 間民宿 <span className="vendor-caret">{isOpen ? "▲" : "▼"}</span></div>
            </button>
            {isOpen && (
              <div className="vendor-stays">
                {list.length === 0 && <div style={{ color: "var(--muted)", padding: "10px 16px" }}>尚未綁定民宿。</div>}
                {list.map((s) => {
                  const live = !!s.published && s.visibility === "published";
                  return (
                    <div className="vendor-stay-row" key={s.id}>
                      <span className="vs-name">{s.name}</span>
                      <span className="vs-loc">{s.region || ""}{s.town ? " · " + s.town : ""}</span>
                      <span className={"pill " + (live ? "live" : "draft")}>{live ? "已公開" : "待審核 / 隱藏"}</span>
                      {s.ad_tier && s.ad_tier !== "free" && <span className="pill feat">{TIER_LABEL[s.ad_tier] || s.ad_tier}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
