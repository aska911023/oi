"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SaveTripButton({ tripId }: { tripId: string; compact?: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !alive) return;
      setUid(user.id);
      const { data } = await sb.from("saved_trips").select("trip_id").eq("user_id", user.id).eq("trip_id", tripId).maybeSingle();
      if (alive) setSaved(!!data);
    })();
    return () => { alive = false; };
  }, [tripId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!uid) { router.push("/login?next=/trips"); return; }
    setBusy(true);
    const sb = createClient();
    if (saved) { await sb.from("saved_trips").delete().eq("user_id", uid).eq("trip_id", tripId); setSaved(false); }
    else { await sb.from("saved_trips").insert({ user_id: uid, trip_id: tripId }); setSaved(true); }
    setBusy(false);
    router.refresh();
  }

  return (
    <button className={"trip-act bm" + (saved ? " on" : "")} onClick={toggle} disabled={busy} title={saved ? "已收藏" : "收藏"} aria-label="收藏">
      <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" /></svg>
    </button>
  );
}
