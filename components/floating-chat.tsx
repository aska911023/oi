"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { promptLogin } from "@/lib/login-gate";
import ChatPanel from "./chat-panel";

type Scope = "stay" | "mine" | "support";
interface Conv { id: string; kind: string; stay_id: string | null; vendor_id: string | null; customer_id: string | null; last_at: string }
interface Item { id: string; label: string; sub: string; preview: string; unread: boolean }

// 右下角浮動聊天(蝦皮 / Messenger 風):對話清單(最後訊息預覽 + 未讀紅點)→ 進單一對話。
//  scope="stay" 消費者民宿頁(單一民宿) · "mine" 業者後台 · "support" 總後台(業者客服)
export default function FloatingChat({ scope, stayId, stayName }: { scope: Scope; stayId?: string; stayName?: string }) {
  const [open, setOpen] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [title, setTitle] = useState("訊息");
  const [items, setItems] = useState<Item[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);

  // 背景:收件匣 scope 載入未讀數並每 30 秒更新(FAB 紅點)
  useEffect(() => {
    if (scope === "stay") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) return;
      uidRef.current = user.id; setMeId(user.id);
      refreshInbox(user.id);
      timer = setInterval(() => { if (document.visibilityState === "visible") refreshInbox(user.id); }, 30000);
    })();
    return () => { if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function refreshInbox(uid: string) {
    const sb = createClient();
    let q = sb.from("conversations").select("*").order("last_at", { ascending: false }).limit(40);
    if (scope === "support") q = q.eq("kind", "support");
    else q = q.or(`vendor_id.eq.${uid},customer_id.eq.${uid}`);
    const { data } = await q;
    const convs = (data as Conv[]) || [];
    if (convs.length === 0) { setItems([]); setUnreadTotal(0); return; }
    const ids = convs.map((c) => c.id);
    const sIds = [...new Set(convs.map((c) => c.stay_id).filter(Boolean))] as string[];
    const vIds = [...new Set(convs.filter((c) => c.kind === "support").map((c) => c.vendor_id).filter(Boolean))] as string[];
    const [msgsR, readsR, staysR, profsR] = await Promise.all([
      sb.from("messages").select("conv_id,body,sender_id,created_at").in("conv_id", ids).order("created_at", { ascending: false }).limit(300),
      sb.from("conversation_reads").select("conv_id,last_read_at").in("conv_id", ids),
      sIds.length ? sb.from("stays").select("id,name").in("id", sIds) : Promise.resolve({ data: [] }),
      vIds.length ? sb.from("profiles").select("id,display_name,full_name").in("id", vIds) : Promise.resolve({ data: [] }),
    ]);
    const lastBy = new Map<string, { body: string; sender_id: string; created_at: string }>();
    for (const m of (msgsR.data || []) as { conv_id: string; body: string; sender_id: string; created_at: string }[]) if (!lastBy.has(m.conv_id)) lastBy.set(m.conv_id, m);
    const readBy = new Map(((readsR.data || []) as { conv_id: string; last_read_at: string }[]).map((r) => [r.conv_id, r.last_read_at]));
    const sm = new Map(((staysR.data || []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
    const vm = new Map(((profsR.data || []) as { id: string; display_name?: string; full_name?: string }[]).map((p) => [p.id, p.display_name || p.full_name || "業者"]));
    let total = 0;
    const its: Item[] = convs.map((c) => {
      const lm = lastBy.get(c.id);
      const read = readBy.get(c.id);
      const unread = !!lm && lm.sender_id !== uid && (!read || new Date(lm.created_at) > new Date(read));
      if (unread) total++;
      let label: string;
      if (c.kind === "support") label = scope === "support" ? `業者 · ${vm.get(c.vendor_id || "") || "—"}` : "平台客服";
      else label = c.customer_id === uid ? (sm.get(c.stay_id || "") || "民宿") : `房客諮詢 · ${sm.get(c.stay_id || "") || "民宿"}`;
      return { id: c.id, label, preview: lm?.body || "尚無訊息", unread, sub: new Date(c.last_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) };
    });
    setItems(its); setUnreadTotal(total);
  }

  async function toggle() {
    if (open) { setOpen(false); return; }
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (scope === "stay") {
      if (!user) { promptLogin(typeof window !== "undefined" ? window.location.pathname : "/", { title: "私訊民宿", desc: "加入會員即可直接私訊民宿詢問。" }); return; }
      setMeId(user.id); setOpen(true); setLoading(true); setErr(null); setConvId(null);
      const { data, error } = await sb.rpc("get_or_create_conversation", { p_kind: "booking", p_stay_id: stayId });
      setLoading(false);
      if (error) { setErr(error.message); return; }
      setConvId(data as string); setTitle(stayName || "民宿");
    } else {
      setOpen(true); setConvId(null);
      if (user) { uidRef.current = user.id; setMeId(user.id); refreshInbox(user.id); }
    }
  }

  async function startSupport() {
    const sb = createClient();
    const { data } = await sb.rpc("get_or_create_conversation", { p_kind: "support", p_stay_id: null });
    if (data) { setConvId(data as string); setTitle("平台客服"); }
  }

  function openConv(it: Item) {
    setConvId(it.id); setTitle(it.label);
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, unread: false } : x)));
    setUnreadTotal((n) => (it.unread ? Math.max(0, n - 1) : n));
  }

  return (
    <>
      <button onClick={toggle} aria-label="聊天"
        style={{ position: "fixed", right: 18, bottom: 18, width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--green)", color: "#fff", fontSize: 24, boxShadow: "0 6px 20px rgba(15,74,66,.4)", zIndex: 90, display: "grid", placeItems: "center" }}>
        {open ? "✕" : "💬"}
        {!open && unreadTotal > 0 && (
          <span style={{ position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10, background: "#e03131", color: "#fff", fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center", border: "2px solid #fff" }}>{unreadTotal > 9 ? "9+" : unreadTotal}</span>
        )}
      </button>
      {open && (
        <div style={{ position: "fixed", right: 18, bottom: 84, width: 350, maxWidth: "calc(100vw - 32px)", height: 530, maxHeight: "calc(100vh - 130px)", background: "#fff", borderRadius: 16, boxShadow: "0 12px 44px rgba(0,0,0,.28)", zIndex: 91, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(120deg,#1b7366,#0f4a42)", color: "#fff", padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}>
            {convId && scope !== "stay" && <button onClick={() => setConvId(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>‹</button>}
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{convId ? title : "訊息"}</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: convId ? "10px 12px" : 0, display: "flex", flexDirection: "column" }}>
            {err ? <p style={{ padding: 16, color: "#c0392b", fontSize: 14 }}>{err}</p>
              : loading ? <p style={{ padding: 16, color: "var(--muted)", fontSize: 14 }}>載入中…</p>
              : convId && meId ? <ChatPanel convId={convId} meId={meId} height={440} />
              : (
                <>
                  {scope === "mine" && (
                    <button onClick={startSupport} style={{ textAlign: "left", padding: "12px 14px", border: "none", borderBottom: "1px solid var(--border)", background: "var(--green-soft)", color: "var(--green)", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>＋ 聯絡平台客服</button>
                  )}
                  {items.length === 0
                    ? <p style={{ padding: 16, color: "var(--muted)", fontSize: 14 }}>還沒有對話。</p>
                    : items.map((it) => (
                      <button key={it.id} onClick={() => openConv(it)}
                        style={{ textAlign: "left", padding: "11px 14px", border: "none", borderBottom: "1px solid var(--border)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <b style={{ fontSize: 14, fontWeight: it.unread ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</b>
                            <span style={{ fontSize: 11, color: "var(--muted)", flex: "none" }}>{it.sub}</span>
                          </span>
                          <span style={{ display: "block", fontSize: 12.5, color: it.unread ? "var(--text)" : "var(--muted)", fontWeight: it.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{it.preview}</span>
                        </span>
                        {it.unread && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e03131", flex: "none" }} />}
                      </button>
                    ))}
                </>
              )}
          </div>
        </div>
      )}
    </>
  );
}
