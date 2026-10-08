"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAdmin } from "@/lib/admin-log";
import BlocksRender from "@/components/blocks-render";
import { revalidateSettings } from "@/app/actions";
import type { SiteSettings, Block, BlockType, AlignChoice, FontChoice } from "@/lib/site-settings-types";

const ALIGN: [AlignChoice, string][] = [["left", "靠左"], ["center", "置中"], ["right", "靠右"]];
const TYPE_LABEL: Record<BlockType, string> = { heading: "標題", text: "文字", image: "圖片", carousel: "輪播", split: "圖文並排", button: "按鈕", spacer: "間距", embeds: "影音/IG" };
const genId = () => "b" + Math.random().toString(36).slice(2, 9);

function newBlock(type: BlockType): Block {
  switch (type) {
    case "heading": return { id: genId(), type, text: "新標題", color: "#12201C", font: "serif", size: 32, align: "left" };
    case "text": return { id: genId(), type, text: "新段落文字", color: "#5D706A", font: "sans", size: 16, align: "left" };
    case "image": return { id: genId(), type, image: "", width: 100, align: "left" };
    case "carousel": return { id: genId(), type, images: [""], width: 100 };
    case "button": return { id: genId(), type, text: "按鈕文字", href: "", align: "left" };
    case "spacer": return { id: genId(), type, height: 32 };
    case "embeds": return { id: genId(), type, embeds: [""] };
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
  const previewOuterRef = useRef<HTMLDivElement>(null);
  const previewInnerRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pScale, setPScale] = useState(1); // 即時預覽縮放
  const [pH, setPH] = useState<number | undefined>(undefined); // 縮放後高度
  const [fScale, setFScale] = useState(1); // iframe 桌機縮放

  const REAL_W = 1136; // 前台 shell 內容寬(1200 − padding)
  const DESK_W = 1440; // 桌機模擬寬
  const PAD = 26; // 即時預覽左右內距,分隔線對齊用

  useEffect(() => {
    const measure = () => {
      const outer = previewOuterRef.current, inner = previewInnerRef.current;
      if (outer && inner) {
        const sc = Math.min(1, outer.clientWidth / REAL_W);
        setPScale(sc);
        setPH(inner.offsetHeight * sc);
      }
      const dev = deviceRef.current;
      if (dev) setFScale(Math.min(1, (dev.clientWidth - 32) / DESK_W));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (previewOuterRef.current) ro.observe(previewOuterRef.current);
    if (previewInnerRef.current) ro.observe(previewInnerRef.current);
    if (deviceRef.current) ro.observe(deviceRef.current);
    return () => ro.disconnect();
  }, [s.blocks, s.hero_layout, s.hero_split_ratio, s.bg_color, s.color_primary, s.color_accent, previewMode]);

  function onDividerMove(clientX: number) {
    if (!dragging.current || !previewInnerRef.current) return;
    const r = previewInnerRef.current.getBoundingClientRect(); // 已縮放後尺寸
    const padS = PAD * pScale;
    const content = r.width - padS * 2;
    if (content <= 0) return;
    const pct = Math.round(((clientX - r.left - padS) / content) * 100);
    set("hero_split_ratio", Math.min(80, Math.max(20, pct)));
  }

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
      search_hint: s.search_hint, hero_layout: s.hero_layout, hero_split_ratio: s.hero_split_ratio, logo_image: s.logo_image, logo_size: s.logo_size,
      footer_logo_image: s.footer_logo_image, footer_logo_size: s.footer_logo_size,
      contact_email: s.contact_email, contact_line: s.contact_line, contact_phone: s.contact_phone,
      contact_ig: s.contact_ig, contact_fb: s.contact_fb, brand_philosophy: s.brand_philosophy,
      share_title: s.share_title, share_desc: s.share_desc,
      footer_about: s.footer_about, footer_copyright: s.footer_copyright, footer_tagline: s.footer_tagline,
      about_body: s.about_body, contact_intro: s.contact_intro, comment_banned_words: s.comment_banned_words, blocks: s.blocks, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    logAdmin("edit", { type: "site", name: "首頁設定" });
    revalidateSettings().catch(() => {}); // 讓前台讀取快取即時失效
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
        <div className="panel-head"><b>內容預覽(即時)</b><span className="sub">{s.hero_layout === "split" ? "拖拉中間綠線調文字/圖片比例" : "改文字/顏色會立刻變;虛線=區塊範圍"}</span></div>
        <div className="preview-outline" ref={previewOuterRef}
          style={{ position: "relative", overflow: "hidden", height: pH, background: s.bg_color, borderRadius: 14, border: "1px solid var(--border)", touchAction: "none" }}>
          <div ref={previewInnerRef}
            style={{ width: REAL_W, transform: `scale(${pScale})`, transformOrigin: "top left", padding: `24px ${PAD}px`, boxSizing: "border-box", position: "relative" }}>
            <BlocksRender blocks={s.blocks} layout={s.hero_layout} ratio={s.hero_split_ratio} />
            {s.hero_layout === "split" && (
              <div
                className="split-divider"
                style={{ left: `calc(${PAD}px + (100% - ${PAD * 2}px) * ${s.hero_split_ratio} / 100)` }}
                title="拖拉調整 文字 / 圖片 比例"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; }}
                onPointerMove={(e) => onDividerMove(e.clientX)}
                onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
              >
                <span className="split-grip" />
                <span className="split-badge">{s.hero_split_ratio}% / {100 - s.hero_split_ratio}%</span>
              </div>
            )}
          </div>
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
        <div className="device-frame" data-mode={previewMode} ref={deviceRef}>
          {previewMode === "desktop" ? (
            <div style={{ width: DESK_W * fScale, height: 860 * fScale, overflow: "hidden", borderRadius: 8, boxShadow: "var(--shadow)" }}>
              <iframe key={previewKey} src="/" title="實際預覽"
                style={{ width: DESK_W, height: 860, border: 0, transform: `scale(${fScale})`, transformOrigin: "top left", background: "#fff" }} />
            </div>
          ) : (
            <iframe key={previewKey} src="/" title="實際預覽" />
          )}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>電腦模式=模擬 1440px 桌機寬(等比縮小),手機=390px。改完按下方「儲存並套用」會自動更新。</p>
      </div>

      {/* 區塊編輯 */}
      <div className="panel">
        <div className="panel-head"><b>首頁區塊</b><span className="sub">新增 / 排序 / 刪除,每塊可調樣式</span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>版面</span>
          <div className="align-seg">
            <button className={s.hero_layout === "stack" ? "on" : ""} onClick={() => set("hero_layout", "stack")}>直式堆疊</button>
            <button className={s.hero_layout === "split" ? "on" : ""} onClick={() => set("hero_layout", "split")}>左文右圖</button>
            <button className={s.hero_layout === "banner" ? "on" : ""} onClick={() => set("hero_layout", "banner")}>橫幅(整張圖+字)</button>
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
              {b.type === "embeds" && (
                <>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px" }}>貼上 YouTube / Instagram 貼文 / TikTok 連結,一格一個;前台會自動排成一面牆(不用自己打貼文)。</p>
                  {(b.embeds || []).map((u, k) => (
                    <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <input value={u} placeholder="https://www.instagram.com/p/… 或 https://youtu.be/…"
                        onChange={(e) => { const arr = [...(b.embeds || [])]; arr[k] = e.target.value; updateBlock(b.id, { embeds: arr }); }}
                        style={{ flex: 1, border: "1px solid var(--border-strong)", borderRadius: 9, padding: "9px 11px", font: "inherit" }} />
                      <button className="lnk danger" onClick={() => updateBlock(b.id, { embeds: (b.embeds || []).filter((_, x) => x !== k) })}>移除</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => updateBlock(b.id, { embeds: [...(b.embeds || []), ""] })}>＋ 加連結</button>
                </>
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
        <div className="field"><label>行程留言 — 關鍵字過濾(逗號或換行分隔;留言含到任一詞會被擋下)</label>
          <textarea rows={3} value={s.comment_banned_words} onChange={(e) => set("comment_banned_words", e.target.value)} placeholder="例:髒話1, 髒話2, 廣告關鍵字" /></div>
        <div className="frow">
          <div className="field" style={{ margin: 0 }}><label>聯絡 Email(聯絡我們頁)</label><input value={s.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="hello@…" /></div>
          <div className="field" style={{ margin: 0 }}><label>官方 LINE 連結</label><input value={s.contact_line} onChange={(e) => set("contact_line", e.target.value)} placeholder="https://line.me/…" /></div>
          <div className="field" style={{ margin: 0 }}><label>聯絡電話</label><input value={s.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="field" style={{ margin: 0 }}><label>Instagram 連結</label><input value={s.contact_ig} onChange={(e) => set("contact_ig", e.target.value)} placeholder="https://instagram.com/…" /></div>
          <div className="field" style={{ margin: 0 }}><label>Facebook 連結</label><input value={s.contact_fb} onChange={(e) => set("contact_fb", e.target.value)} placeholder="https://facebook.com/…" /></div>
        </div>
        <div className="field"><label>品牌理念(顯示在聯絡我們頁上方)</label><textarea rows={3} value={s.brand_philosophy} onChange={(e) => set("brand_philosophy", e.target.value)} placeholder="一句話講你們的理念…" /></div>
        <div className="field"><label>分享卡標題(貼網址到 LINE / FB 時顯示的大標)</label><input value={s.share_title} onChange={(e) => set("share_title", e.target.value)} placeholder="偶宿 O! · 台灣民宿搜尋" /></div>
        <div className="field"><label>分享卡說明(標題下方的小字)</label><textarea rows={2} value={s.share_desc} onChange={(e) => set("share_desc", e.target.value)} placeholder="一句話介紹,貼連結分享時會顯示…" /></div>
        <div className="field"><label>品牌故事頁內容(可換行,空一行分段)</label><textarea rows={5} value={s.about_body} onChange={(e) => set("about_body", e.target.value)} /></div>
        <div className="field"><label>聯絡我們頁 — 開頭說明</label><textarea rows={2} value={s.contact_intro} onChange={(e) => set("contact_intro", e.target.value)} /></div>
        <div className="field"><label>頁尾 — 品牌簡介(可換行)</label><textarea rows={2} value={s.footer_about} onChange={(e) => set("footer_about", e.target.value)} /></div>
        <div className="frow">
          <div className="field" style={{ margin: 0 }}><label>頁尾 — 版權文字</label><input value={s.footer_copyright} onChange={(e) => set("footer_copyright", e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label>頁尾 — 標語</label><input value={s.footer_tagline} onChange={(e) => set("footer_tagline", e.target.value)} /></div>
        </div>
        <div className="field"><label>頁首 Logo(左上角;留空用預設 O!)</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {s.logo_image && <img src={s.logo_image} alt="logo" style={{ height: s.logo_size }} />}
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
              {uploadingId === "logo" ? "上傳中…" : s.logo_image ? "更換" : "選檔上傳"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingId !== null}
                onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingId("logo"); const u = await uploadImage(f); setUploadingId(null); if (u) set("logo_image", u); }} />
            </label>
            <input value={s.logo_image} onChange={(e) => set("logo_image", e.target.value)} placeholder="或貼網址" style={{ flex: 1, minWidth: 180 }} />
            {s.logo_image && <button className="lnk danger" onClick={() => set("logo_image", "")}>移除</button>}
          </div>
          <div className="style-controls" style={{ marginTop: 8 }}>
            <span className="sc-num">Logo 大小<input type="number" min={20} max={120} value={s.logo_size} onChange={(e) => set("logo_size", Number(e.target.value))} />px</span>
          </div>
        </div>
        <div className="field"><label>頁尾 Logo(網站最下方;留空則沿用頁首 Logo)</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {s.footer_logo_image && <img src={s.footer_logo_image} alt="footer logo" style={{ height: s.footer_logo_size }} />}
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
              {uploadingId === "footer-logo" ? "上傳中…" : s.footer_logo_image ? "更換" : "選檔上傳"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingId !== null}
                onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingId("footer-logo"); const u = await uploadImage(f); setUploadingId(null); if (u) set("footer_logo_image", u); }} />
            </label>
            <input value={s.footer_logo_image} onChange={(e) => set("footer_logo_image", e.target.value)} placeholder="或貼網址(留空沿用頁首)" style={{ flex: 1, minWidth: 180 }} />
            {s.footer_logo_image && <button className="lnk danger" onClick={() => set("footer_logo_image", "")}>移除</button>}
          </div>
          <div className="style-controls" style={{ marginTop: 8 }}>
            <span className="sc-num">Logo 大小<input type="number" min={20} max={160} value={s.footer_logo_size} onChange={(e) => set("footer_logo_size", Number(e.target.value))} />px</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6, position: "sticky", bottom: 16 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || uploadingId !== null}>{busy ? "儲存中…" : "儲存並套用"}</button>
        {saved && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓ 已儲存,重整首頁即可看到</span>}
      </div>
    </div>
  );
}
