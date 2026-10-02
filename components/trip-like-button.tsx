"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TripLikeButton({ tripId, count = 0 }: { tripId: string; count?: number }) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [n, setN] = useState(count);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !alive) return;
      setUid(user.id);
      const { data } = await sb.from("trip_likes").select("trip_id").eq("user_id", user.id).eq("trip_id", tripId).maybeSingle();
      if (alive) setLiked(!!data);
    })();
    return () => { alive = false; };
  }, [tripId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!uid) { router.push("/login?next=/trips"); return; }
    setBusy(true);
    const sb = createClient();
    if (liked) { await sb.from("trip_likes").delete().eq("user_id", uid).eq("trip_id", tripId); setLiked(false); setN((x) => Math.max(0, x - 1)); }
    else { await sb.from("trip_likes").insert({ user_id: uid, trip_id: tripId }); setLiked(true); setN((x) => x + 1); }
    setBusy(false);
  }

  return (
    <button className={"trip-act like" + (liked ? " on" : "")} onClick={toggle} disabled={busy} title="按讚" aria-label="按讚">
      <svg width="21" height="21" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21C6 16.5 3 13 3 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 9 3.2C21 13 18 16.5 12 21z" /></svg>
      {n > 0 && <span className="trip-act-n">{n}</span>}
    </button>
  );
}
