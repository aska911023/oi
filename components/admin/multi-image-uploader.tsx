"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/img";

// 多張圖片上傳(第一張為封面)。上傳到 site bucket;也可貼網址新增。
export default function MultiImageUploader({
  value, onChange, prefix = "img", compact = false, max = 5,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  prefix?: string;
  compact?: boolean;
  max?: number; // 每個區塊最多幾張(預設 5)
}) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const imgs = value || [];
  const full = imgs.length >= max;

  async function addFiles(files: FileList) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) { alert("請選圖片檔"); return; }
    const room = max - imgs.length;
    if (room <= 0) { alert(`最多 ${max} 張圖片`); return; }
    const list = imageFiles.slice(0, room);
    if (imageFiles.length > room) alert(`最多 ${max} 張,只會加入前 ${room} 張`);
    setUploading(true);
    const sb = createClient();
    const added: string[] = [];
    for (const raw of list) {
      // 上傳前先在瀏覽器壓縮(長邊 1600 + WebP);手機原圖常 3MB 以上,直接傳會很慢
      const file = await compressImage(raw);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await sb.storage.from("site").upload(path, file, {
        upsert: true, cacheControl: "31536000", contentType: file.type,
      });
      if (error) {
        const msg = /row-level security|not authorized|permission|unauthorized/i.test(error.message)
          ? "沒有上傳權限。請確認帳號有權限,或聯絡平台。"
          : /exceeded|too large|size/i.test(error.message)
            ? "照片太大或超過容量上限,請換張小一點的。"
            : "照片上傳失敗,請稍後再試一次。";
        alert(msg);
        continue;
      }
      added.push(sb.storage.from("site").getPublicUrl(path).data.publicUrl);
    }
    setUploading(false);
    if (added.length) onChange([...imgs, ...added]);
  }

  const remove = (i: number) => onChange(imgs.filter((_, k) => k !== i));
  const makeCover = (i: number) => { if (i === 0) return; const next = [...imgs]; const [x] = next.splice(i, 1); next.unshift(x); onChange(next); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return;
    const next = [...imgs]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };

  // 貼網址防呆:擋掉 IG/FB/YT/TikTok 的「貼文頁連結」(那不是圖片檔,會變成壞掉的空白格)
  function addUrl() {
    const u = url.trim();
    if (!u || imgs.length >= max) return;
    const bad =
      /instagram\.com\/(p|reel|tv|share)\//i.test(u) || /(facebook|fb)\.com/i.test(u) || /(youtube\.com|youtu\.be|tiktok\.com)/i.test(u)
        ? "這是貼文/社群連結,不是圖片 ❌\n請直接「選檔上傳」照片,或貼圖片檔網址(結尾為 .jpg / .png / .webp)。"
        : !/^https?:\/\//i.test(u)
          ? "請貼完整的圖片網址(http 開頭),或直接上傳照片。"
          : "";
    if (bad) { alert(bad); return; }
    onChange([...imgs, u]);
    setUrl("");
  }

  return (
    <div className="miu">
      {imgs.length > 0 && (
        <div className={"miu-grid" + (compact ? " sm" : "")}>
          {imgs.map((src, i) => (
            <div className={"miu-cell" + (i === 0 ? " cover" : "")} key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              {i === 0 && <span className="miu-badge">封面</span>}
              <div className="miu-ops">
                <button type="button" title="往前" onClick={() => move(i, -1)} disabled={i === 0}>‹</button>
                {i !== 0 && <button type="button" title="設為封面" onClick={() => makeCover(i)}>★</button>}
                <button type="button" title="往後" onClick={() => move(i, 1)} disabled={i === imgs.length - 1}>›</button>
                <button type="button" className="del" title="刪除" onClick={() => remove(i)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {full ? (
        <p style={{ fontSize: 13, fontWeight: 700, color: "#c0392b", margin: imgs.length ? "8px 0 0" : 0 }}>已達上限,最多 {max} 張。要換圖請先刪掉一張。</p>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: imgs.length ? 8 : 0 }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            {uploading ? "上傳中…" : imgs.length ? `再加圖片(還可 ${max - imgs.length} 張)` : `選檔上傳(可多選,最多 ${max} 張)`}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={uploading}
              onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="或貼圖片檔網址(.jpg/.png/.webp)" style={{ flex: 1, minWidth: 150 }}
            onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { e.preventDefault(); addUrl(); } }} />
          {url.trim() && <button type="button" className="btn btn-ghost btn-sm" onClick={addUrl}>加入</button>}
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>照片 <b style={{ color: full ? "#c0392b" : "var(--green)" }}>{imgs.length} / {max}</b> 張(最多 {max} 張){imgs.length > 1 ? ";第一張為封面,用 ‹ › 調整順序、★ 設為封面" : ""}。</p>
    </div>
  );
}
