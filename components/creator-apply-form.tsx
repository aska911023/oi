"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 申請成為創作者:留 IG/YT 連結 + 聯繫 email + 備註;送出後由偶宿主動聯絡。
export default function CreatorApplyForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [links, setLinks] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [intro, setIntro] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!links.trim()) { alert("請至少留一個 IG 或 YouTube 連結"); return; }
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { alert("請留一個可聯繫的 email"); return; }
    setSending(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setSending(false); alert("登入狀態失效,請重新登入。"); return; }
    const { error } = await sb.from("creator_applications").insert({ applicant_id: user.id, links: links.trim(), contact_email: email.trim(), intro: intro.trim() || null });
    setSending(false);
    if (error) { alert("送出失敗:" + error.message); return; }
    setDone(true);
  }

  if (done) return <div className="empty">✅ 已送出申請!我們會看過你的內容後主動跟你聯絡 😊</div>;

  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <div className="pb-grid">
        <div className="wide"><label>你的 IG / YouTube 連結(可多個,一行一個)</label>
          <textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={"https://instagram.com/你的帳號\nhttps://youtube.com/@你的頻道"} /></div>
        <div className="wide"><label>聯繫 email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="we@contact.you" /></div>
        <div className="wide"><label>備註(選填)</label>
          <textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="簡單介紹你,或你想分享什麼內容" /></div>
      </div>
      <div className="plan-actions"><button className="btn btn-primary" onClick={submit} disabled={sending}>{sending ? "送出中…" : "送出申請"}</button></div>
    </div>
  );
}
