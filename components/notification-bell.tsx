"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

interface N { kind: string; trip_id: string | null; trip_title: string | null; actor: string; actor_id?: string | null; actor_avatar?: string | null; created_at: string }
const SEEN_KEY = "oi_notif_seen";
const verb = (k: string) => (k === "like" ? "按讚了你的行程" : k === "comment" ? "留言了你的行程" : k === "follow" ? "開始追蹤你" : "收藏了你的行程");
const mark = (k: string) => (k === "like" ? "♥" : k === "comment" ? "💬" : k === "follow" ? "👤" : "🔖");
const linkOf = (n: N) => (n.kind === "follow" ? (n.actor_id ? `/u/${n.actor_id}` : "#") : `/trips/${n.trip_id}`);

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

  // 已讀門檻用 epoch(毫秒)數字比較,避免不同來源時間戳字串格式不一致造成誤判。
  // 相容舊版存的 ISO 字串(解析成 epoch)。
  function getSeen(): number {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n : (new Date(raw).getTime() || 0);
    } catch { return 0; }
  }

  async function load() {
    try {
      const { data } = await createClient().rpc("my_notifications", { lim: 30 });
      const rows = (data as N[]) || [];
      setList(rows);
      const seen = getSeen();
      setUnread(rows.filter((r) => new Date(r.created_at).getTime() > seen).length);
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
    if (next) {
      // 開啟 = 把目前所有通知標記為已讀(存最新一則的 epoch,沒有就用現在時間)
      const newest = list.length ? new Date(list[0].created_at).getTime() : Date.now();
      try { localStorage.setItem(SEEN_KEY, String(newest)); } catch { /* ignore */ }
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
            <div className="notif-empty">還沒有通知。等別人追蹤你、或對你的公開行程按讚、留言、收藏吧。</div>
          ) : (
            <div className="notif-list">
              {list.map((n, i) => (
                <Link key={i} href={linkOf(n)} className="notif-item" onClick={() => setOpen(false)}>
                  <span className="notif-ava"><Avatar src={n.actor_avatar} name={n.actor} size={34} /><span className="notif-mark">{mark(n.kind)}</span></span>
                  <span className="notif-text"><b>{n.actor}</b> {verb(n.kind)}{n.kind !== "follow" && <>「{n.trip_title}」</>}</span>
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
