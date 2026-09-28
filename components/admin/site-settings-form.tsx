"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SiteSettings, ElStyle, AlignChoice, FontChoice } from "@/lib/site-settings";

const famCss = (f: FontChoice) => (f === "sans" ? '"Noto Sans TC",sans-serif' : '"Noto Serif TC",serif');
const ALIGN: [AlignChoice, string][] = [["left", "靠左"], ["center", "置中"], ["right", "靠右"]];
type ElKey = "eyebrow" | "title" | "subtitle";

export default function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => { setS((p) => ({ ...p, [k]: v })); setSaved(false); };
  const setStyle = (el: ElKey, patch: Partial<ElStyle>) => {
    setS((p) => ({ ...p, hero_styles: { ...p.hero_styles, [el]: { ...p.hero_styles[el], ...patch } } }));
    setSaved(false);
  };

  async function uploadFile(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) { alert("請選擇圖片檔"); return null; }
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `hero-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) { alert("上傳失敗:" + error.message); return null; }
    return sb.storage.from("site").getPublicUrl(path).data.publicUrl;
  }
  async function onUpload(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(i);
    const url = await uploadFile(file);
    setUploading(null);
    if (url) { const imgs = [...s.hero_images]; imgs[i] = url; set("hero_images", imgs); }
  }
  const addImage = () => { if (s.hero_images.length < 4) set("hero_images", [...s.hero_images, ""]); };
  const removeImage = (i: number) => set("hero_images", s.hero_images.filter((_, k) => k !== i));
  const setImageUrl = (i: number, v: string) => { const imgs = [...s.hero_images]; imgs[i] = v; set("hero_images", imgs); };

  async function save() {
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("site_settings").update({
      hero_eyebrow: s.hero_eyebrow, hero_title: s.hero_title, hero_subtitle: s.hero_subtitle,
      hero_caption: s.hero_caption, search_hint: s.search_hint,
      hero_images: s.hero_images.filter((x) => x.trim()),
      color_primary: s.color_primary, color_accent: s.color_accent, bg_color: s.bg_color,
      hero_styles: s.hero_styles, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setSaved(true);
  }

  const StyleRow = ({ el }: { el: ElKey }) => {
    const st = s.hero_styles[el];
    return (
      <div className="style-controls">
        <select value={st.font} onChange={(e) => setStyle(el, { font: e.target.value as FontChoice })}>
          <option value="serif">襯線</option><option value="sans">黑體</option>
        </select>
        <input type="color" value={st.color} onChange={(e) => setStyle(el, { color: e.target.value })} title="文字顏色" />
        <span className="sc-num"><input type="number" min={10} max={80} value={st.size} onChange={(e) => setStyle(el, { size: Number(e.target.value) })} />px</span>
        <div className="align-seg">
          {ALIGN.map(([v, l]) => (
            <button key={v} className={st.align === v ? "on" : ""} onClick={() => setStyle(el, { align: v })}>{l}</button>
          ))}
        </div>
      </div>
    );
  };

  const eb = s.hero_styles.eyebrow, tt = s.hero_styles.title, sub = s.hero_styles.subtitle;

  return (
    <div style={{ maxWidth: 820 }}>
      {/* 即時預覽 */}
      <div className="panel">
        <div className="panel-head"><b>即時預覽</b><span className="sub">改哪裡,這裡立刻變</span></div>
        <div className="hero-preview" style={{ background: s.bg_color }}>
          <div className="hp-copy">
            <div style={{ color: eb.color, fontFamily: famCss(eb.font), fontSize: 12, textAlign: eb.align, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>{s.hero_eyebrow}</div>
            <div style={{ color: tt.color, fontFamily: famCss(tt.font), fontSize: Math.min(tt.size, 34), textAlign: tt.align, fontWeight: 800, lineHeight: 1.3, margin: "4px 0 8px" }}>{s.hero_title}</div>
            <div style={{ color: sub.color, fontFamily: famCss(sub.font), fontSize: Math.min(sub.size, 16), textAlign: sub.align }}>{s.hero_subtitle}</div>
          </div>
          <div className="hp-img">{s.hero_images[0] ? <img src={s.hero_images[0]} alt="" /> : <div className="hp-empty">尚無圖片</div>}</div>
        </div>
      </div>

      {/* 文字 + 每段樣式 */}
      <div className="panel">
        <div className="panel-head"><b>文字內容與樣式</b><span className="sub">每段可各自選字體 / 顏色 / 大小 / 對齊</span></div>
        <div className="field"><label>上標(小字)</label><input value={s.hero_eyebrow} onChange={(e) => set("hero_eyebrow", e.target.value)} /><StyleRow el="eyebrow" /></div>
        <div className="field"><label>大標題</label><input value={s.hero_title} onChange={(e) => set("hero_title", e.target.value)} /><StyleRow el="title" /></div>
        <div className="field"><label>副標</label><input value={s.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} /><StyleRow el="subtitle" /></div>
        <div className="frow">
          <div className="field"><label>圖片說明</label><input value={s.hero_caption} onChange={(e) => set("hero_caption", e.target.value)} /></div>
          <div className="field"><label>搜尋列下方備註</label><input value={s.search_hint} onChange={(e) => set("search_hint", e.target.value)} /></div>
        </div>
      </div>

      {/* 品牌色 */}
      <div className="panel">
        <div className="panel-head"><b>品牌色與底色</b><span className="sub">按鈕、標籤與頁面底色(全站)</span></div>
        <div className="frow">
          <div className="field"><label>主色(按鈕)</label>
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
        <div className="field"><label>頁面底色</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={s.bg_color} onChange={(e) => set("bg_color", e.target.value)} style={{ width: 52, height: 42, padding: 2 }} />
            <input value={s.bg_color} onChange={(e) => set("bg_color", e.target.value)} style={{ maxWidth: 200 }} />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>整個消費者網站的背景色</span>
          </div>
        </div>
      </div>

      {/* 主視覺輪播 */}
      <div className="panel">
        <div className="panel-head"><b>主視覺輪播</b><span className="sub">最多 4 張,自動輪播</span></div>
        <div className="img-list">
          {s.hero_images.map((img, i) => (
            <div className="img-item" key={i}>
              <div className="img-thumb">{img ? <img src={img} alt="" /> : <span>空</span>}</div>
              <div className="img-ctl">
                <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                  {uploading === i ? "上傳中…" : img ? "更換" : "選檔上傳"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onUpload(i, e)} disabled={uploading !== null} />
                </label>
                <input value={img} onChange={(e) => setImageUrl(i, e.target.value)} placeholder="或貼網址" />
                <button className="lnk danger" onClick={() => removeImage(i)}>移除</button>
              </div>
            </div>
          ))}
        </div>
        {s.hero_images.length < 4 && <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={addImage}>＋ 新增照片</button>}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || uploading !== null}>{busy ? "儲存中…" : "儲存並套用"}</button>
        {saved && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓ 已儲存,重整首頁即可看到</span>}
      </div>
    </div>
  );
}
