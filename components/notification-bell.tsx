"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

// 社群通知(my_notifications RPC)+ 系統通知(notifications 表,例:民宿審核上架)合併顯示。
interface Social { kind: string; trip_id: string | null; trip_title: string | null; actor: string; actor_id?: string | null; actor_avatar?: string | null; created_at: string }
interface Sys { id: string; kind: string; title: string; href: string | null; created_at: string }
interface Row { id: string; isSys: boolean; mark: string; href: string; created_at: string; actor?: string; actor_avatar?: string | null; text: string }

const SEEN_KEY = "oi_notif_seen";
const verb = (k: string) => (k === "like" ? "按讚了你的行程" : k === "comment" ? "留言了你的行程" : k === "follow" ? "開始追蹤你" : "收藏了你的行程");
const mark = (k: string) => (k === "like" ? "♥" : k === "comment" ? "💬" : k === "follow" ? "👤" : "🔖");
const socialHref = (n: Social) => (n.kind === "follow" ? (n.actor_id ? `/u/${n.actor_id}` : "#") : `/trips/${n.trip_id}`);

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
  const [list, setList] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

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
      const sb = createClient();
      const [socRes, userRes] = await Promise.all([sb.rpc("my_notifications", { lim: 30 }), sb.auth.getSession()]);
      const social: Row[] = ((socRes.data as Social[]) || []).map((n, i) => ({
        id: "s" + i + (n.trip_id || n.actor_id || ""),
        isSys: false, mark: mark(n.kind), href: socialHref(n), created_at: n.created_at,
        actor: n.actor, actor_avatar: n.actor_avatar,
        text: verb(n.kind) + (n.kind !== "follow" && n.trip_title ? `「${n.trip_title}」` : ""),
      }));
      let sys: Row[] = [];
      const user = userRes.data.session?.user ?? null;
      if (user) {
        const { data } = await sb.from("notifications").select("id, kind, title, href, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
        sys = ((data as Sys[]) || []).map((n) => ({ id: "n" + n.id, isSys: true, mark: n.kind === "admin_stay" ? "📋" : "✅", href: n.href || "#", created_at: n.created_at, text: n.title }));
      }
      const rows = [...social, ...sys].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setList(rows);
      const seen = getSeen();
      setUnread(rows.filter((r) => new Date(r.created_at).getTime() > seen).length);
    } catch { /* ignore */ }
  }

  // 純前端輪詢(非 cron/伺服器排程):只在「本分頁可見」時每 120 秒查一次自己的通知;
  // 切到背景就停、回來再查一次 → 省請求(背景分頁完全不查)。
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const start = () => { if (!timer) timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 120000); };
    const onVis = () => { if (document.visibilityState === "visible") { load(); start(); } else stop(); };
    load();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
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
            <div className="notif-empty">還沒有通知。</div>
          ) : (
            <div className="notif-list">
              {list.map((n) => (
                <Link key={n.id} href={n.href} className="notif-item" onClick={() => setOpen(false)}>
                  {n.isSys
                    ? <span className="notif-ava" style={{ fontSize: 20, display: "grid", placeItems: "center", width: 34, height: 34, background: "var(--green-soft)", borderRadius: "50%" }}>{n.mark}</span>
                    : <span className="notif-ava"><Avatar src={n.actor_avatar} name={n.actor || ""} size={34} /><span className="notif-mark">{n.mark}</span></span>}
                  <span className="notif-text">{n.isSys ? n.text : <><b>{n.actor}</b> {n.text}</>}</span>
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
