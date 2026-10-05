"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PostLikeButton({ postId, count = 0, liked = false }: { postId: string; count?: number; liked?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(liked);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login?next=/feed"); return; }
    if (on) { await sb.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId); setOn(false); setN((x) => Math.max(0, x - 1)); }
    else { await sb.from("post_likes").insert({ user_id: user.id, post_id: postId }); setOn(true); setN((x) => x + 1); }
    setBusy(false);
  }

  return (
    <button className={"trip-act like" + (on ? " on" : "")} onClick={toggle} disabled={busy} title="按讚" aria-label="按讚">
      <svg width="23" height="23" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21C6 16.5 3 13 3 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 9 3.2C21 13 18 16.5 12 21z" /></svg>
      {n > 0 && <span className="trip-act-n">{n}</span>}
    </button>
  );
}
