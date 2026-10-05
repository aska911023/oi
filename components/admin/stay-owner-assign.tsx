"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Member { id: string; display_name: string | null; full_name: string | null; role: string }
interface Snap { id: string; created_at: string; reason: string | null; owner_before: string | null; owner_after: string | null }

const who = (m: Member) => m.display_name || m.full_name || m.id.slice(0, 8);

export default function StayOwnerAssign({ stayId, stayName, ownerId, onClose, onDone }: {
  stayId: string;
  stayName: string;
  ownerId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [pick, setPick] = useState<string>(ownerId || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [{ data: ms }, { data: ss }] = await Promise.all([
        sb.from("profiles").select("id,display_name,full_name,role")
          .in("role", ["partner", "admin"]).order("display_name"),
        sb.from("stay_snapshots").select("id,created_at,reason,owner_before,owner_after")
          .eq("stay_id", stayId).order("created_at", { ascending: false }).limit(10),
      ]);
      setMembers((ms as Member[]) || []);
      setSnaps((ss as Snap[]) || []);
    })();
  }, [stayId]);

  const current = members.find((m) => m.id === ownerId);

  async function assign(target: string | null) {
    setBusy(true);
    setMsg(null);
    const sb = createClient();
    const { error } = await sb.rpc("assign_stay_owner", { p_stay: stayId, p_owner: target });
    setBusy(false);
    if (error) { setMsg("失敗:" + error.message); return; }
    onDone();
    onClose();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="editor" role="dialog" aria-modal="true" style={{ width: "min(640px, 94vw)" }}>
        <h2>指派業主 — {stayName}</h2>

        <p className="imp-hint">
          指派後,該業者登入可在「我的民宿」自行編輯這筆資料與底下所有房型(房型權限是跟著民宿走的,不用另外轉)。
          你身為管理者仍然看得到、改得動,也能隨時收回。
          <b>每次指派或收回,系統都會自動把當下的資料與房型存成快照</b>,對方改壞了還原得回來。
        </p>

        <dl className="kv">
          <div>
            <dt>目前業主</dt>
            <dd>{ownerId ? (current ? `${who(current)}(${current.role}）` : ownerId) : "平台自管(尚未指派)"}</dd>
          </div>
        </dl>

        <div className="field" style={{ marginTop: 16 }}>
          <label>指派給(只列出 partner / admin 身分的會員)</label>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">— 請選擇 —</option>
            {members.map((m) => <option key={m.id} value={m.id}>{who(m)}({m.role})</option>)}
          </select>
          {members.length === 0 && (
            <p style={{ fontSize: 13, color: "#a5303a", marginTop: 8 }}>
              目前沒有 partner 身分的會員。請先到「業者審核」通過申請,或在「會員」頁把該帳號改成業者。
            </p>
          )}
        </div>

        {msg && <p style={{ color: "#a5303a", fontSize: 14 }}>{msg}</p>}

        {snaps.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>快照紀錄</h3>
            <div className="atable-wrap" style={{ maxHeight: 180, overflow: "auto" }}>
              <table className="atable">
                <thead><tr><th>時間</th><th>原因</th></tr></thead>
                <tbody>
                  {snaps.map((s) => (
                    <tr key={s.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(s.created_at).toLocaleString("zh-TW")}</td>
                      <td>{s.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="editor-actions">
          <button className="btn btn-ghost" onClick={onClose}>關閉</button>
          {ownerId && (
            <button className="btn btn-ghost danger" onClick={() => assign(null)} disabled={busy}>
              收回自管
            </button>
          )}
          <button className="btn btn-primary" onClick={() => assign(pick)} disabled={busy || !pick || pick === ownerId}>
            {busy ? "處理中…" : "存快照並指派"}
          </button>
        </div>
      </div>
    </>
  );
}
