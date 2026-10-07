"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

interface Person { id: string; name: string | null; avatar: string | null }
type Stats = { followers: number; following: number; is_following: boolean };

export default function FollowBar({ uid, initial, viewer: viewerProp }: { uid: string; initial?: Stats; viewer?: string | null }) {
  const router = useRouter();
  const [viewer, setViewer] = useState<string | null>(viewerProp ?? null);
  const [s, setS] = useState<Stats>(initial ?? { followers: 0, following: 0, is_following: false });
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "followers" | "following">(null);
  const [people, setPeople] = useState<Person[] | null>(null);

  async function loadStats() {
    const sb = createClient();
    const { data } = await sb.rpc("follow_stats", { p_uid: uid });
    if (data) setS(data as Stats);
  }
  useEffect(() => {
    if (initial) return; // 伺服器已帶入初始值 → 不用再打一輪(數字立刻出現,不會慢)
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!alive) return;
      setViewer(user?.id || null);
      await loadStats();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const isSelf = !!viewer && viewer === uid;

  async function toggleFollow() {
    if (!viewer) { router.push(`/login?next=/u/${uid}`); return; }
    setBusy(true);
    const sb = createClient();
    if (s.is_following) {
      await sb.from("follows").delete().eq("follower_id", viewer).eq("following_id", uid);
      setS((p) => ({ ...p, is_following: false, followers: Math.max(0, p.followers - 1) }));
    } else {
      const { error } = await sb.from("follows").insert({ follower_id: viewer, following_id: uid });
      if (!error) setS((p) => ({ ...p, is_following: true, followers: p.followers + 1 }));
    }
    setBusy(false);
  }

  async function openList(kind: "followers" | "following") {
    setModal(kind); setPeople(null);
    const sb = createClient();
    const { data } = await sb.rpc("follow_list", { p_uid: uid, p_kind: kind });
    setPeople((data as Person[]) || []);
  }

  return (
    <div className="follow-bar">
      <div className="follow-counts">
        <button className="follow-count" onClick={() => openList("followers")}>
          <b>{s.followers}</b> 粉絲
        </button>
        <button className="follow-count" onClick={() => openList("following")}>
          <b>{s.following}</b> 追蹤中
        </button>
      </div>
      {!isSelf && (
        <button className={"btn btn-sm " + (s.is_following ? "btn-ghost" : "btn-primary")} onClick={toggleFollow} disabled={busy}>
          {s.is_following ? "追蹤中" : "+ 追蹤"}
        </button>
      )}

      {modal && (
        <>
          <div className="overlay" onClick={() => setModal(null)} />
          <div className="editor" role="dialog" aria-modal="true" style={{ width: "min(420px, 94vw)" }}>
            <h2>{modal === "followers" ? "粉絲" : "追蹤中"}</h2>
            {people === null ? (
              <p style={{ color: "var(--muted)", padding: "16px 0" }}>載入中…</p>
            ) : people.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "16px 0" }}>{modal === "followers" ? "還沒有粉絲。" : "還沒有追蹤任何人。"}</p>
            ) : (
              <div className="follow-list">
                {people.map((p) => (
                  <button key={p.id} className="follow-person" onClick={() => { setModal(null); router.push(`/u/${p.id}`); }}>
                    <Avatar src={p.avatar} name={p.name || "旅人"} size={38} />
                    <span>{p.name || "旅人"}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="editor-actions"><button className="btn btn-ghost" onClick={() => setModal(null)}>關閉</button></div>
          </div>
        </>
      )}
    </div>
  );
}
