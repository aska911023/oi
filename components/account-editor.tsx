"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

export default function AccountEditor({ initialAvatar, initialName }: { initialAvatar: string | null; initialName: string }) {
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [name, setName] = useState(initialName);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { alert("請選圖片檔"); return; }
    setUploading(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setUploading(false); return; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `avatar-${user.id}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("site").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) { setUploading(false); alert("上傳失敗:" + error.message); return; }
    const url = sb.storage.from("site").getPublicUrl(path).data.publicUrl;
    await sb.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setAvatar(url);
    setUploading(false);
    setMsg("頭貼已更新");
  }

  async function save() {
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await sb.from("profiles").update({ display_name: name.trim() || null }).eq("id", user.id);
    setBusy(false);
    setMsg(error ? "儲存失敗:" + error.message : "已儲存");
  }

  return (
    <div className="account-editor">
      <div className="ae-avatar">
        <Avatar src={avatar} name={name} size={88} />
        <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
          {uploading ? "上傳中…" : "上傳頭貼"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
      </div>
      <div className="ae-field">
        <label>暱稱</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的暱稱" />
      </div>
      <div className="ae-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "儲存中…" : "儲存"}</button>
        {msg && <span className="ae-msg">{msg}</span>}
      </div>
    </div>
  );
}
