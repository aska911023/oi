"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SiteSettings } from "@/lib/site-settings";

export default function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("請選擇圖片檔"); return; }
    setUploading(true);
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `hero-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) { setUploading(false); alert("上傳失敗:" + error.message); return; }
    const { data } = sb.storage.from("site").getPublicUrl(path);
    set("hero_image", data.publicUrl);
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("site_settings").update({
      hero_eyebrow: s.hero_eyebrow, hero_title: s.hero_title, hero_subtitle: s.hero_subtitle,
      hero_caption: s.hero_caption, search_hint: s.search_hint, hero_image: s.hero_image,
      color_primary: s.color_primary, color_accent: s.color_accent,
      heading_font: s.heading_font, hero_title_size: Number(s.hero_title_size),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setSaved(true);
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="panel">
        <div className="panel-head"><b>文字內容</b><span className="sub">首頁主視覺文案</span></div>
        <div className="field"><label>上標(小字)</label><input value={s.hero_eyebrow} onChange={(e) => set("hero_eyebrow", e.target.value)} /></div>
        <div className="field"><label>大標題</label><input value={s.hero_title} onChange={(e) => set("hero_title", e.target.value)} /></div>
        <div className="field"><label>副標</label><input value={s.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} /></div>
        <div className="frow">
          <div className="field"><label>圖片說明</label><input value={s.hero_caption} onChange={(e) => set("hero_caption", e.target.value)} /></div>
          <div className="field"><label>搜尋列下方備註</label><input value={s.search_hint} onChange={(e) => set("search_hint", e.target.value)} /></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><b>外觀</b><span className="sub">顏色・字體・大小</span></div>
        <div className="frow">
          <div className="field"><label>主色(按鈕/重點)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="color" value={s.color_primary} onChange={(e) => set("color_primary", e.target.value)} style={{ width: 52, height: 42, padding: 2 }} />
              <input value={s.color_primary} onChange={(e) => set("color_primary", e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <div className="field"><label>強調色(標籤)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="color" value={s.color_accent} onChange={(e) => set("color_accent", e.target.value)} style={{ width: 52, height: 42, padding: 2 }} />
              <input value={s.color_accent} onChange={(e) => set("color_accent", e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
        <div className="frow">
          <div className="field"><label>標題字體</label>
            <select value={s.heading_font} onChange={(e) => set("heading_font", e.target.value as "serif" | "sans")}>
              <option value="serif">襯線(Noto Serif TC)</option>
              <option value="sans">黑體(Noto Sans TC)</option>
            </select>
          </div>
          <div className="field"><label>大標尺寸(px)</label>
            <input type="number" min={24} max={72} value={s.hero_title_size} onChange={(e) => set("hero_title_size", Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><b>主視覺圖片</b><span className="sub">可直接選檔上傳,或貼圖片網址</span></div>
        {s.hero_image && (
          <img src={s.hero_image} alt="預覽" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginBottom: 14 }} />
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            {uploading ? "上傳中…" : "選擇檔案上傳"}
            <input type="file" accept="image/*" onChange={upload} style={{ display: "none" }} disabled={uploading} />
          </label>
          <input value={s.hero_image} onChange={(e) => set("hero_image", e.target.value)} placeholder="或貼上圖片網址 https://…" style={{ flex: 1, minWidth: 220, padding: "11px 13px", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 14 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>{busy ? "儲存中…" : "儲存並套用"}</button>
        {saved && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓ 已儲存,重新整理首頁即可看到</span>}
      </div>
    </div>
  );
}
