"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SaveButton({ stayId }: { stayId: string }) {
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
      const { data } = await sb.from("saved").select("stay_id").eq("user_id", user.id).eq("stay_id", stayId).maybeSingle();
      if (alive) setSaved(!!data);
    })();
    return () => { alive = false; };
  }, [stayId]);

  async function toggle() {
    if (!uid) { router.push("/login?next=/stay/" + stayId); return; }
    setBusy(true);
    const sb = createClient();
    if (saved) { await sb.from("saved").delete().eq("user_id", uid).eq("stay_id", stayId); setSaved(false); }
    else { await sb.from("saved").insert({ user_id: uid, stay_id: stayId }); setSaved(true); }
    setBusy(false);
  }

  return (
    <button className={"btn btn-ghost" + (saved ? " on-saved" : "")} onClick={toggle} disabled={busy}>
      {saved ? "♥ 已收藏" : "♡ 收藏"}
    </button>
  );
}
