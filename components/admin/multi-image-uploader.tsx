"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/img";

// 多張圖片上傳(第一張為封面)。上傳到 site bucket;也可貼網址新增。
export default function MultiImageUploader({
  value, onChange, prefix = "img", compact = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  prefix?: string;
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const imgs = value || [];

  async function addFiles(files: FileList) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) { alert("請選圖片檔"); return; }
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
      if (error) { alert("上傳失敗:" + error.message); continue; }
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
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: imgs.length ? 8 : 0 }}>
        <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
          {uploading ? "上傳中…" : imgs.length ? "再加圖片" : "選檔上傳(可多選)"}
          <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={uploading}
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="或貼圖片網址 https://…" style={{ flex: 1, minWidth: 150 }}
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { e.preventDefault(); onChange([...imgs, url.trim()]); setUrl(""); } }} />
        {url.trim() && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange([...imgs, url.trim()]); setUrl(""); }}>加入</button>}
      </div>
      {imgs.length > 1 && <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>第一張為封面;用 ‹ › 調整順序、★ 設為封面。</p>}
    </div>
  );
}
