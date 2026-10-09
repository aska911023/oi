"use client";

import { useState, useEffect } from "react";
import SearchAutocomplete from "@/components/search-autocomplete";

// Header 左側搜尋:點一下往下展開一條搜尋欄(不跳頁),選了結果或按 Esc 收合。
export default function HeaderSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="hsearch">
      <button type="button" className={"hsearch-btn" + (open ? " on" : "")} onClick={() => setOpen((o) => !o)} aria-label="搜尋" aria-expanded={open}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
      </button>
      {open && (
        <>
          <div className="hsearch-backdrop" onClick={() => setOpen(false)} />
          <div className="hsearch-panel">
            <div className="shell"><SearchAutocomplete autoFocus onNavigate={() => setOpen(false)} /></div>
          </div>
        </>
      )}
    </div>
  );
}
