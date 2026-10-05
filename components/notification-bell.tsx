"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface N { kind: string; trip_id: string; trip_title: string; actor: string; created_at: string }
const SEEN_KEY = "oi_notif_seen";
const verb = (k: string) => (k === "like" ? "按讚了你的行程" : k === "comment" ? "留言了你的行程" : "收藏了你的行程");
const mark = (k: string) => (k === "like" ? "♥" : k === "comment" ? "💬" : "🔖");

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-TW");
}

export default function NotificationBell() {
  const [list, setList] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const { data } = await createClient().rpc("my_notifications", { lim: 30 });
      const rows = (data as N[]) || [];
      setList(rows);
      let seen = "";
      try { seen = localStorage.getItem(SEEN_KEY) || ""; } catch { /* ignore */ }
      setUnread(rows.filter((r) => !seen || r.created_at > seen).length);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && list.length) {
      try { localStorage.setItem(SEEN_KEY, list[0].created_at); } catch { /* ignore */ }
      setUnread(0);
    }
  }

  return (
    <div className="notif-wrap" ref={boxRef}>
      <button className="notif-btn" onClick={toggle} aria-label="通知" title="通知">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">通知</div>
          {list.length === 0 ? (
            <div className="notif-empty">還沒有通知。等別人對你的公開行程按讚、留言或收藏吧。</div>
          ) : (
            <div className="notif-list">
              {list.map((n, i) => (
                <Link key={i} href={`/trips/${n.trip_id}`} className="notif-item" onClick={() => setOpen(false)}>
                  <span className="notif-mark">{mark(n.kind)}</span>
                  <span className="notif-text"><b>{n.actor}</b> {verb(n.kind)}「{n.trip_title}」</span>
                  <span className="notif-time">{ago(n.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
