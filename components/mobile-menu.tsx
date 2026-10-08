"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Avatar from "@/components/avatar";

export default function MobileMenu({ loggedIn, name, avatarUrl = null, isAdmin, isPartner = false }: { loggedIn: boolean; name: string; avatarUrl?: string | null; isAdmin: boolean; isPartner?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 開啟時鎖背景捲動
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);

  const drawer = (
    <div className={"m-drawer" + (open ? " open" : "")} role="dialog" aria-modal="true" aria-hidden={!open}>
      <div className="m-backdrop" onClick={close} />
      <div className="m-panel">
        <div className="m-panel-head">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {loggedIn ? <><Avatar src={avatarUrl} name={name} size={30} /> 歡迎,{name}</> : "偶宿 O!"}
          </span>
          <button className="m-close" onClick={close} aria-label="關閉選單">✕</button>
        </div>
        <nav className="m-links">
          <Link href="/" onClick={close}>探索民宿</Link>
          <Link href="/places/attraction" onClick={close}>探索景點</Link>
          <Link href="/rentals" onClick={close}>租車</Link>
          <Link href="/plan" onClick={close}>規劃行程</Link>
          <Link href="/trips" onClick={close}>行程分享</Link>
          <Link href="/contact" onClick={close}>聯絡我們</Link>
          <div className="m-div" />
          {loggedIn ? (
            <>
              <Link href="/me/trips" onClick={close}>我的行程</Link>
              {isAdmin && <Link href="/admin" onClick={close}>管理後台</Link>}
              {isPartner && <Link href="/vendor" onClick={close}>業者後台</Link>}
              <Link href="/account" onClick={close}>我的帳號</Link>
            </>
          ) : (
            <Link href="/login" className="m-cta" onClick={close}>登入 / 註冊</Link>
          )}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <button className="hamburger" onClick={() => setOpen(true)} aria-label="開啟選單" aria-expanded={open}>
        <span /><span /><span />
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
