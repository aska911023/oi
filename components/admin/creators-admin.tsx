"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface App {
  id: string; applicant_id: string; links?: string | null; contact_email?: string | null;
  intro?: string | null; status: string; created_at?: string; name?: string | null;
}
interface Perf { id: string; name?: string | null; avatar?: string | null; trips: number; articles: number; followers: number; likes: number; saves: number; comments: number; }

export default function CreatorsAdmin() {
  const [list, setList] = useState<App[]>([]);
  const [perf, setPerf] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const sb = createClient();
    const [{ data }, { data: perfData }] = await Promise.all([
      sb.from("creator_applications").select("id,applicant_id,links,contact_email,intro,status,created_at, profiles(display_name)").order("created_at", { ascending: false }),
      sb.rpc("creator_performance"),
    ]);
    const rows = ((data as unknown as (App & { profiles?: { display_name?: string } })[]) || []).map((r) => ({ ...r, name: r.profiles?.display_name }));
    setList(rows);
    setPerf((perfData as Perf[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function decide(a: App, approve: boolean) {
    if (!confirm(approve ? `通過「${a.name || a.contact_email}」成為創作者?` : "拒絕這個申請?")) return;
    const sb = createClient();
    const { error: e1 } = await sb.from("creator_applications").update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    if (e1) { alert("失敗:" + e1.message); return; }
    if (approve) {
      const { error: e2 } = await sb.from("profiles").update({ role: "creator" }).eq("id", a.applicant_id);
      if (e2) { alert("設定角色失敗:" + e2.message); return; }
    }
    load();
  }

  const badge = (s: string) => s === "approved" ? <span className="pill live">已通過</span> : s === "rejected" ? <span className="pill draft">已拒絕</span> : <span className="pill" style={{ background: "#fff3e0", color: "#b4690e" }}>待審核</span>;

  if (loading) return <p style={{ color: "var(--muted)" }}>載入中…</p>;

  return (
    <>
      <h2 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>創作者成效</h2>
      {perf.length === 0 ? (
        <div className="empty" style={{ marginBottom: 28 }}>還沒有創作者(通過申請後會出現在這)。</div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 30 }}>
          <table className="cperf">
            <thead><tr><th>創作者</th><th>行程</th><th>粉絲</th><th>讚</th><th>收藏</th><th>留言</th></tr></thead>
            <tbody>
              {perf.map((c) => (
                <tr key={c.id}><td>{c.name || "(未命名)"}</td><td>{c.trips}</td><td>{c.followers}</td><td>{c.likes}</td><td>{c.saves}</td><td>{c.comments}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>創作者申請</h2>
      {!list.length ? <div className="empty">目前沒有創作者申請。</div> : (
        <div className="art-list">
          {list.map((a) => (
        <div className="art-row" key={a.id} style={{ alignItems: "flex-start" }}>
          <div className="art-main">
            <div className="art-title">{a.name || "(未命名)"} {badge(a.status)}</div>
            <div className="art-meta" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              {a.contact_email && <span>✉ {a.contact_email}</span>}
              {a.links && a.links.split("\n").filter(Boolean).map((l, i) => <a key={i} className="lnk" href={l.trim()} target="_blank" rel="noopener noreferrer">{l.trim()}</a>)}
              {a.intro && <span style={{ color: "var(--text-2)" }}>備註:{a.intro}</span>}
            </div>
          </div>
          {a.status === "pending" && (
            <div className="art-actions">
              <button className="lnk" onClick={() => decide(a, true)}>通過</button>
              <button className="lnk danger" onClick={() => decide(a, false)}>拒絕</button>
            </div>
          )}
        </div>
          ))}
        </div>
      )}
    </>
  );
}
