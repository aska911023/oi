"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SaveTripButton({ tripId, compact }: { tripId: string; compact?: boolean }) {
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
    <button className={"trip-save" + (saved ? " on" : "")} onClick={toggle} disabled={busy} title={saved ? "已收藏" : "加入收藏行程"}>
      {saved ? "♥" : "♡"}{compact ? "" : saved ? " 已收藏" : " 收藏"}
    </button>
  );
}
