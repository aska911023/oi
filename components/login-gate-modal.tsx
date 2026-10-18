"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onPromptLogin } from "@/lib/login-gate";

// 掛在 (site)/layout 一次;監聽 promptLogin() 跳出「加入會員」彈窗。
export default function LoginGateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("/");
  const [copy, setCopy] = useState<{ title: string; desc: string }>({
    title: "加入偶宿會員",
    desc: "登入後即可收藏喜歡的民宿、規劃專屬行程。",
  });

  useEffect(() => onPromptLogin((nextPath, c) => {
    setNext(nextPath || "/");
    setCopy({
      title: c?.title || "加入偶宿會員",
      desc: c?.desc || "登入後即可收藏喜歡的民宿、規劃專屬行程。",
    });
    setOpen(true);
  }), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const go = (mode: "login" | "register") => {
    setOpen(false);
    const q = new URLSearchParams({ next });
    if (mode === "register") q.set("mode", "register");
    router.push("/login?" + q.toString());
  };

  return (
    <div className="lg-overlay" onClick={() => setOpen(false)}>
      <div className="lg-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="lg-close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
        <div className="lg-mark" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#17635a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" />
          </svg>
        </div>
        <h2>{copy.title}</h2>
        <p>{copy.desc}</p>
        <button className="btn btn-primary lg-cta" onClick={() => go("register")}>免費註冊</button>
        <button className="btn btn-ghost lg-cta" onClick={() => go("login")}>已有帳號,登入</button>
      </div>
    </div>
  );
}
