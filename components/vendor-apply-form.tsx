"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Defaults {
  business_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  line_url: string;
  fb_url: string;
  note: string;
}

export default function VendorApplyForm({ userId, defaults }: { userId: string; defaults: Defaults }) {
  const router = useRouter();
  const [f, setF] = useState<Defaults>(defaults);
  const [licensePath, setLicensePath] = useState<string>("");
  const [licenseName, setLicenseName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof Defaults, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function uploadLicense(file: File) {
    const okType = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) { alert("請上傳圖片或 PDF"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("檔案請小於 10MB"); return; }
    setUploading(true);
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/license-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("vendor-docs").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { alert("上傳失敗:" + error.message); return; }
    setLicensePath(path);
    setLicenseName(file.name);
  }

  async function submit() {
    if (!f.business_name.trim()) { alert("請填店名"); return; }
    if (!f.phone.trim()) { alert("請填電話"); return; }
    if (!f.address.trim()) { alert("請填地址"); return; }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from("vendor_applications").insert({
      applicant_id: userId,
      business_name: f.business_name.trim(),
      address: f.address.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      website: f.website.trim(),
      line_url: f.line_url.trim(),
      fb_url: f.fb_url.trim(),
      license_url: licensePath || null,
      note: f.note.trim() || null,
      status: "pending",
    });
    setBusy(false);
    if (error) { alert("送出失敗:" + error.message); return; }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="apply-state ok" style={{ marginTop: 18 }}>
        已收到你的申請!偶宿團隊審核後會以 Email 通知,通過後即可開始上架。
      </div>
    );
  }

  return (
    <div className="apply-form">
      <div className="af-grid">
        <div className="wide"><label>店名 / 民宿名稱 *</label><input value={f.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="例:海邊的日子民宿" /></div>
        <div className="wide"><label>地址 *</label><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="例:屏東縣恆春鎮…" /></div>
        <div><label>電話 *</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="市話或手機" /></div>
        <div><label>Email</label><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="聯絡信箱" /></div>
        <div><label>官方網站</label><input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" /></div>
        <div><label>官方 LINE</label><input value={f.line_url} onChange={(e) => set("line_url", e.target.value)} placeholder="LINE 連結或 ID" /></div>
        <div className="wide"><label>官方 Facebook</label><input value={f.fb_url} onChange={(e) => set("fb_url", e.target.value)} placeholder="https://facebook.com/…" /></div>
        <div className="wide">
          <label>營業執照 / 民宿登記證(圖片或 PDF)</label>
          <div className="af-upload">
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
              {uploading ? "上傳中…" : licensePath ? "更換檔案" : "選擇檔案"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} disabled={uploading}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLicense(file); }} />
            </label>
            <span style={{ fontSize: 13, color: licensePath ? "var(--green)" : "var(--muted)" }}>
              {licensePath ? `✓ 已上傳:${licenseName}` : "尚未上傳(審核用,不會公開)"}
            </span>
          </div>
        </div>
        <div className="wide"><label>備註(選填)</label><textarea rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="想補充給審核團隊的說明" /></div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 18, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={submit} disabled={busy || uploading}>{busy ? "送出中…" : "送出申請"}</button>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>送出即表示同意偶宿依審核目的使用上述資料。</span>
      </div>
    </div>
  );
}
