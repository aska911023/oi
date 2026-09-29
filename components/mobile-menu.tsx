"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { POI_KINDS } from "@/lib/types";

export default function MobileMenu({ loggedIn, name, isAdmin }: { loggedIn: boolean; name: string; isAdmin: boolean }) {
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
          <span>{loggedIn ? `歡迎,${name}` : "偶宿 O!"}</span>
          <button className="m-close" onClick={close} aria-label="關閉選單">✕</button>
        </div>
        <nav className="m-links">
          <Link href="/" onClick={close}>探索民宿</Link>
          {POI_KINDS.map((k) => <Link key={k.slug} href={`/places/${k.slug}`} onClick={close}>{k.label}</Link>)}
          <div className="m-div" />
          {loggedIn ? (
            <>
              {isAdmin && <Link href="/admin" onClick={close}>管理後台</Link>}
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
