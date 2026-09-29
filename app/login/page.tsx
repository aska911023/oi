"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import PasswordInput from "@/components/password-input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    const supabase = createClient();
    const dest = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("next")) || "/";

    if (mode === "register") {
      if (!displayName.trim() || !fullName.trim() || !phone.trim() || !address.trim() || !email.trim())
        return setErr("請完整填寫所有欄位。");
      if (password.length < 8) return setErr("密碼至少 8 碼。");
      if (password !== confirm) return setErr("兩次密碼不一致。");
      if (!agreed) return setErr("請先勾選同意服務條款與隱私權政策。");
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim(), full_name: fullName.trim(), phone: phone.trim(), address: address.trim() } },
      });
      setBusy(false);
      if (error) return setErr(error.message);
      if (!data.session) {
        // 需要 email 驗證
        return setMsg("註冊成功!請到信箱點擊驗證連結後再登入。");
      }
      router.push(dest);
      router.refresh();
      return;
    }

    // login
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr("登入失敗:帳號或密碼錯誤。");
    router.push(dest);
    router.refresh();
  }

  return (
    <>
      <header className="topbar solid">
        <div className="shell"><Logo /></div>
      </header>

      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-mark">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#17635a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
          </div>
          <h1>{mode === "login" ? "歡迎回來" : "加入偶宿"}</h1>
          <p>{mode === "login" ? "登入後收藏你喜歡的民宿。" : "填一下基本資料,開始你的下一段小旅行。"}</p>

          <div className="auth-tabs">
            <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setErr(""); setMsg(""); }}>登入</button>
            <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setErr(""); setMsg(""); }}>註冊</button>
          </div>

          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <div className="auth-field"><label>暱稱 *</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="想被怎麼稱呼" required /></div>
                <div className="auth-field"><label>姓名 *</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="真實姓名(訂房聯絡用)" required /></div>
                <div className="auth-field"><label>手機 *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx-xxx-xxx" inputMode="tel" required /></div>
                <div className="auth-field"><label>通訊地址 *</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="縣市 / 鄉鎮 / 街道地址" required /></div>
              </>
            )}
            <div className="auth-field"><label>Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <div className="auth-field"><label>密碼 *</label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "至少 8 碼" : "輸入密碼"} minLength={mode === "register" ? 8 : undefined} /></div>
            {mode === "register" && (
              <div className="auth-field"><label>確認密碼 *</label><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再輸入一次" /></div>
            )}

            {mode === "register" && (
              <label className="auth-consent">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>我已閱讀並同意 <a href="/terms" target="_blank" rel="noopener">服務條款</a> 與 <a href="/privacy" target="_blank" rel="noopener">隱私權與個人資料保護政策</a>,並同意本平台依政策蒐集、處理及利用我的個人資料。</span>
              </label>
            )}

            {err && <div className="auth-err">{err}</div>}
            {msg && <div className="notice" style={{ marginTop: 12 }}>{msg}</div>}

            <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={busy}>
              {busy ? "處理中…" : mode === "login" ? "登入" : "建立帳號"}
            </button>
          </form>

          <p className="auth-note">你的密碼以加密雜湊儲存,本平台無法得知明碼。</p>
        </div>
      </div>
    </>
  );
}
