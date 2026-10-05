"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { revalidateTrips } from "@/app/actions";
import TripCard from "@/components/trip-card";
import type { Trip } from "@/lib/types";

export default function MyTrips({ initial }: { initial: Trip[] }) {
  const [list, setList] = useState<Trip[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from("trips").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });
    setList((data as Trip[]) || []);
    revalidateTrips().catch(() => {});
  }

  async function togglePublic(t: Trip) {
    setBusy(t.id);
    const sb = createClient();
    await sb.from("trips").update({ is_public: !t.is_public }).eq("id", t.id);
    setBusy(null);
    await refresh();
  }

  async function copyLink(t: Trip) {
    const url = `${window.location.origin}/trips/${t.id}`;
    try { await navigator.clipboard.writeText(url); alert("已複製分享連結:\n" + url); }
    catch { prompt("複製這個連結分享:", url); }
  }

  async function remove(t: Trip) {
    if (!confirm(`確定刪除「${t.title}」?此動作無法復原。`)) return;
    setBusy(t.id);
    const sb = createClient();
    await sb.from("trips").delete().eq("id", t.id);
    setBusy(null);
    await refresh();
  }

  if (list.length === 0) {
    return <div className="empty" style={{ marginTop: 20 }}>還沒有儲存的行程。到<Link href="/plan" style={{ color: "var(--green)", textDecoration: "underline" }}>規劃行程</Link>做一個並儲存吧。</div>;
  }

  return (
    <div className="ig-feed">
      {list.map((t) => (
        <TripCard key={t.id} trip={t} manageSlot={
          <>
            {t.is_public ? <span className="pill live">公開</span> : <span className="pill draft">私人</span>}
            <Link className="lnk" href={`/plan?load=${t.id}`}>編輯</Link>
            <button className="lnk" onClick={() => togglePublic(t)} disabled={busy === t.id}>{t.is_public ? "取消公開" : "公開"}</button>
            {t.is_public && <button className="lnk" onClick={() => copyLink(t)}>複製連結</button>}
            <button className="lnk danger" onClick={() => remove(t)} disabled={busy === t.id}>刪除</button>
          </>
        } />
      ))}
    </div>
  );
}
