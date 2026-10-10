import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TripCard from "@/components/trip-card";
import Avatar from "@/components/avatar";
import FollowBar from "@/components/follow-bar";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UserTripsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [{ data }, { data: followStats }, { data: { user } }, prof] = await Promise.all([
    sb.rpc("user_public_trips", { p_uid: id, lim: 50, off: 0 }),
    sb.rpc("follow_stats", { p_uid: id }),
    sb.auth.getUser(),
    sb.from("profiles").select("role").eq("id", id).maybeSingle(),
  ]);
  const d = (data || {}) as { name?: string | null; avatar?: string | null; total?: number; rows?: Trip[] };
  const name = d.name || "旅人";
  const rows = (d.rows || []) as Trip[];
  const isCreator = (prof.data as { role?: string } | null)?.role === "creator";

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="profile-head">
        <Avatar src={d.avatar} name={name} size={64} className="profile-avatar" />
        <div>
          <h1 className="serif" style={{ margin: 0 }}>{name} {isCreator && <span className="creator-badge">✍ 創作者</span>}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{rows.length} 篇公開行程</p>
          <FollowBar uid={id} initial={followStats as { followers: number; following: number; is_following: boolean } | undefined} viewer={user?.id ?? null} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>這位旅人還沒有公開的行程。</div>
      ) : (
        <div className="ig-feed" style={{ marginTop: 24 }}>
          {rows.map((t) => <TripCard key={t.id} trip={t} viewerId={user?.id ?? null} />)}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 26 }}>
        <Link className="lnk" href="/trips">← 回行程分享牆</Link>
      </div>
    </main>
  );
}
