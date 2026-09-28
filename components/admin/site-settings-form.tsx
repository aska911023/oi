"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BlocksRender from "@/components/blocks-render";
import type { SiteSettings, Block, BlockType, AlignChoice, FontChoice } from "@/lib/site-settings-types";

const ALIGN: [AlignChoice, string][] = [["left", "靠左"], ["center", "置中"], ["right", "靠右"]];
const TYPE_LABEL: Record<BlockType, string> = { heading: "標題", text: "文字", image: "圖片", carousel: "輪播", split: "圖文並排", button: "按鈕", spacer: "間距" };
const genId = () => "b" + Math.random().toString(36).slice(2, 9);

function newBlock(type: BlockType): Block {
  switch (type) {
    case "heading": return { id: genId(), type, text: "新標題", color: "#12201C", font: "serif", size: 32, align: "left" };
    case "text": return { id: genId(), type, text: "新段落文字", color: "#5D706A", font: "sans", size: 16, align: "left" };
    case "image": return { id: genId(), type, image: "", width: 100, align: "left" };
    case "carousel": return { id: genId(), type, images: [""], width: 100 };
    case "button": return { id: genId(), type, text: "按鈕文字", href: "", align: "left" };
    case "spacer": return { id: genId(), type, height: 32 };
    case "split": return { id: genId(), type, image: "", text: "在這裡寫一段介紹文字,放在圖片旁邊。", align: "right", color: "#5D706A", font: "sans", size: 16 };
  }
}

export default function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => { setS((p) => ({ ...p, [k]: v })); setSaved(false); };
  const updateBlock = (id: string, patch: Partial<Block>) => set("blocks", s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const deleteBlock = (id: string) => set("blocks", s.blocks.filter((b) => b.id !== id));
  const addBlock = (t: BlockType) => set("blocks", [...s.blocks, newBlock(t)]);
  const moveBlock = (id: string, dir: -1 | 1) => {
    const i = s.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.blocks.length) return;
    const arr = [...s.blocks];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("blocks", arr);
  };

  async function uploadImage(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) { alert("請選擇圖片檔"); return null; }
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `hero-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) { alert("上傳失敗:" + error.message); return null; }
    return sb.storage.from("site").getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("site_settings").update({
      color_primary: s.color_primary, color_accent: s.color_accent, bg_color: s.bg_color,
      search_hint: s.search_hint, hero_layout: s.hero_layout, blocks: s.blocks, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setSaved(true);
    setPreviewKey((k) => k + 1); // 重載實際版面預覽
  }

  const StyleRow = ({ b }: { b: Block }) => (
    <div className="style-controls">
      <select value={b.font || "sans"} onChange={(e) => updateBlock(b.id, { font: e.target.value as FontChoice })}>
        <option value="serif">襯線</option><option value="sans">黑體</option>
      </select>
      <input type="color" value={b.color || "#12201C"} onChange={(e) => updateBlock(b.id, { color: e.target.value })} title="顏色" />
      <span className="sc-num"><input type="number" min={10} max={80} value={b.size || 16} onChange={(e) => updateBlock(b.id, { size: Number(e.target.value) })} />px</span>
      <div className="align-seg">
        {ALIGN.map(([v, l]) => <button key={v} className={b.align === v ? "on" : ""} onClick={() => updateBlock(b.id, { align: v })}>{l}</button>)}
      </div>
    </div>
  );

  const ImgField = ({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) => (
    <div className="img-ctl">
      <div className="img-thumb">{value ? <img src={value} alt="" /> : <span>空</span>}</div>
      <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
        {uploadingId === id ? "上傳中…" : value ? "更換" : "選檔上傳"}
        <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingId !== null}
          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingId(id); const u = await uploadImage(f); setUploadingId(null); if (u) onChange(u); }} />
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="或貼圖片網址" />
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      {/* 即時預覽 */}
      <div className="panel">
        <div className="panel-head"><b>內容預覽(即時)</b><span className="sub">改文字/顏色會立刻變;虛線=區塊範圍</span></div>
        <div className="preview-outline" style={{ background: s.bg_color, borderRadius: 14, border: "1px solid var(--border)", padding: "24px 26px" }}>
          <BlocksRender blocks={s.blocks} layout={s.hero_layout} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <b>實際版面預覽</b>
          <div className="align-seg">
            <button className={previewMode === "desktop" ? "on" : ""} onClick={() => setPreviewMode("desktop")}>電腦</button>
            <button className={previewMode === "mobile" ? "on" : ""} onClick={() => setPreviewMode("mobile")}>手機</button>
          </div>
        </div>
        <div className="device-frame" data-mode={previewMode}>
          <iframe key={previewKey} src="/" title="實際預覽" />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>這是真實響應式效果(依裝置螢幕)。改完按下方「儲存並套用」,這裡會自動更新。</p>
      </div>

      {/* 區塊編輯 */}
      <div className="panel">
        <div className="panel-head"><b>首頁區塊</b><span className="sub">新增 / 排序 / 刪除,每塊可調樣式</span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>版面</span>
          <div className="align-seg">
            <button className={s.hero_layout === "stack" ? "on" : ""} onClick={() => set("hero_layout", "stack")}>直式堆疊</button>
            <button className={s.hero_layout === "split" ? "on" : ""} onClick={() => set("hero_layout", "split")}>左文右圖</button>
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>「左文右圖」= 文字排左、圖片/輪播排右(手機自動堆疊)</span>
        </div>
        <div className="blk-list">
          {s.blocks.map((b, i) => (
            <div className="blk-card" key={b.id}>
              <div className="blk-card-head">
                <span className="blk-type">{TYPE_LABEL[b.type]}</span>
                <div className="blk-card-actions">
                  <button className="lnk" onClick={() => moveBlock(b.id, -1)} disabled={i === 0}>↑</button>
                  <button className="lnk" onClick={() => moveBlock(b.id, 1)} disabled={i === s.blocks.length - 1}>↓</button>
                  <button className="lnk danger" onClick={() => deleteBlock(b.id)}>刪除</button>
                </div>
              </div>

              {(b.type === "heading" || b.type === "text") && (
                <>
                  <textarea rows={b.type === "heading" ? 1 : 2} value={b.text || ""} onChange={(e) => updateBlock(b.id, { text: e.target.value })} />
                  <StyleRow b={b} />
                </>
              )}
              {b.type === "button" && (
                <div className="frow">
                  <div className="field" style={{ margin: 0 }}><label>文字</label><input value={b.text || ""} onChange={(e) => updateBlock(b.id, { text: e.target.value })} /></div>
                  <div className="field" style={{ margin: 0 }}><label>連結</label><input value={b.href || ""} onChange={(e) => updateBlock(b.id, { href: e.target.value })} placeholder="https://…" /></div>
                  <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}><label>對齊</label>
                    <div className="align-seg">{ALIGN.map(([v, l]) => <button key={v} className={b.align === v ? "on" : ""} onClick={() => updateBlock(b.id, { align: v })}>{l}</button>)}</div>
                  </div>
                </div>
              )}
              {b.type === "image" && (
                <>
                  <ImgField id={b.id} value={b.image || ""} onChange={(v) => updateBlock(b.id, { image: v })} />
                  <div className="style-controls">
                    <span className="sc-num">寬<input type="number" min={20} max={100} value={b.width || 100} onChange={(e) => updateBlock(b.id, { width: Number(e.target.value) })} />%</span>
                    <span className="sc-num">高<input type="number" min={0} max={800} value={b.height ?? ""} placeholder="自動" onChange={(e) => updateBlock(b.id, { height: e.target.value ? Number(e.target.value) : undefined })} />px</span>
                    <div className="align-seg">{ALIGN.map(([v, l]) => <button key={v} className={b.align === v ? "on" : ""} onClick={() => updateBlock(b.id, { align: v })}>{l}</button>)}</div>
                  </div>
                </>
              )}
              {b.type === "carousel" && (
                <>
                  {(b.images || []).map((img, k) => (
                    <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <ImgField id={b.id + "-" + k} value={img} onChange={(v) => { const imgs = [...(b.images || [])]; imgs[k] = v; updateBlock(b.id, { images: imgs }); }} />
                      <button className="lnk danger" onClick={() => updateBlock(b.id, { images: (b.images || []).filter((_, x) => x !== k) })}>移除</button>
                    </div>
                  ))}
                  {(b.images || []).length < 4 && <button className="btn btn-ghost btn-sm" onClick={() => updateBlock(b.id, { images: [...(b.images || []), ""] })}>＋ 加照片</button>}
                  <div className="style-controls" style={{ marginTop: 10 }}>
                    <span className="sc-num">寬<input type="number" min={20} max={100} value={b.width || 100} onChange={(e) => updateBlock(b.id, { width: Number(e.target.value) })} />%</span>
                    <span className="sc-num">高<input type="number" min={120} max={800} value={b.height ?? 340} onChange={(e) => updateBlock(b.id, { height: Number(e.target.value) })} />px</span>
                  </div>
                </>
              )}
              {b.type === "spacer" && (
                <span className="sc-num">高度<input type="number" min={8} max={200} value={b.height || 24} onChange={(e) => updateBlock(b.id, { height: Number(e.target.value) })} />px</span>
              )}
              {b.type === "split" && (
                <>
                  <textarea rows={3} value={b.text || ""} onChange={(e) => updateBlock(b.id, { text: e.target.value })} placeholder="圖片旁邊的文字" />
                  <div style={{ marginTop: 8 }}><ImgField id={b.id} value={b.image || ""} onChange={(v) => updateBlock(b.id, { image: v })} /></div>
                  <div className="style-controls">
                    <select value={b.font || "sans"} onChange={(e) => updateBlock(b.id, { font: e.target.value as FontChoice })}><option value="serif">襯線</option><option value="sans">黑體</option></select>
                    <input type="color" value={b.color || "#5D706A"} onChange={(e) => updateBlock(b.id, { color: e.target.value })} title="文字顏色" />
                    <span className="sc-num"><input type="number" min={10} max={40} value={b.size || 16} onChange={(e) => updateBlock(b.id, { size: Number(e.target.value) })} />px</span>
                    <div className="align-seg">
                      <button className={b.align === "left" ? "on" : ""} onClick={() => updateBlock(b.id, { align: "left" })}>圖在左</button>
                      <button className={b.align !== "left" ? "on" : ""} onClick={() => updateBlock(b.id, { align: "right" })}>圖在右</button>
                    </div>
                    <span className="sc-num">圖高<input type="number" min={0} max={800} value={b.height ?? ""} placeholder="自動" onChange={(e) => updateBlock(b.id, { height: e.target.value ? Number(e.target.value) : undefined })} />px</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="blk-add">
          <span>新增區塊:</span>
          {(Object.keys(TYPE_LABEL) as BlockType[]).map((t) => (
            <button key={t} className="btn btn-ghost btn-sm" onClick={() => addBlock(t)}>＋ {TYPE_LABEL[t]}</button>
          ))}
        </div>
      </div>

      {/* 全站色彩 + 備註 */}
      <div className="panel">
        <div className="panel-head"><b>全站色彩與備註</b></div>
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
          </div>
        </div>
        <div className="field"><label>搜尋列下方備註</label><input value={s.search_hint} onChange={(e) => set("search_hint", e.target.value)} /></div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6, position: "sticky", bottom: 16 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || uploadingId !== null}>{busy ? "儲存中…" : "儲存並套用"}</button>
        {saved && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓ 已儲存,重整首頁即可看到</span>}
      </div>
    </div>
  );
}
