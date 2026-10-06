import { redirect } from "next/navigation";
import Link from "next/link";
import MyTrips from "@/components/my-trips";
import SignOutButton from "@/components/signout-button";
import FollowBar from "@/components/follow-bar";
import TripCard from "@/components/trip-card";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyTripsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/trips");
  const { data: profile } = await sb.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
  const role = profile?.role || "user";
  const myName = profile?.display_name || user.email?.split("@")[0] || "我";
  const { data } = await sb.from("trips").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });
  const { data: savedData } = await sb.from("saved_trips").select("trip_id, trips(*)").eq("user_id", user.id).order("created_at", { ascending: false });
  const savedTrips = ((savedData || []) as unknown as { trips: Trip | null }[]).map((r) => r.trips).filter(Boolean) as Trip[];

  // 補上讚/留言數,讓「我的行程」卡片跟 /trips 一致
  const ownTrips = (data as Trip[]) || [];
  const allIds = Array.from(new Set([...ownTrips.map((t) => t.id), ...savedTrips.map((t) => t.id)]));
  const likeMap: Record<string, number> = {}, commentMap: Record<string, number> = {};
  if (allIds.length) {
    const [{ data: lk }, { data: cm }] = await Promise.all([
      sb.from("trip_likes").select("trip_id").in("trip_id", allIds),
      sb.from("trip_comments").select("trip_id").in("trip_id", allIds),
    ]);
    (lk as { trip_id: string }[] | null)?.forEach((r) => { likeMap[r.trip_id] = (likeMap[r.trip_id] || 0) + 1; });
    (cm as { trip_id: string }[] | null)?.forEach((r) => { commentMap[r.trip_id] = (commentMap[r.trip_id] || 0) + 1; });
  }
  const own = ownTrips.map((t) => ({ ...t, owner_name: myName, like_count: likeMap[t.id] || 0, comment_count: commentMap[t.id] || 0 }));
  const saved = savedTrips.map((t) => ({ ...t, like_count: likeMap[t.id] || 0, comment_count: commentMap[t.id] || 0 }));

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 820 }}>
      <div className="plan-head">
        <h1 className="serif">我的行程</h1>
        <p>管理你儲存的行程,可編輯、公開分享或刪除;也能收藏別人的行程當參考。</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
          <FollowBar uid={user.id} />
          <Link href={`/u/${user.id}`} className="lnk">查看我的公開主頁 ›</Link>
        </div>
      </div>

      <div className="account-actions" style={{ marginBottom: 26 }}>
        <Link href="/plan" className="btn btn-primary">＋ 規劃新行程</Link>
        <Link href="/me/saved" className="btn btn-ghost">我的收藏</Link>
        <Link href="/account" className="btn btn-ghost">我的帳號</Link>
        {role === "user" && <Link href="/apply" className="btn btn-ghost">申請成為業者</Link>}
        {(role === "partner" || role === "admin") && <Link href="/vendor" className="btn btn-ghost">業者後台</Link>}
        {role === "admin" && <Link href="/admin" className="btn btn-ghost">管理後台</Link>}
      </div>

      <h2 className="serif shop-h">我發起的</h2>
      <MyTrips initial={own} />

      <h2 className="serif shop-h" style={{ marginTop: 34 }}>我收藏的</h2>
      {savedTrips.length === 0 ? (
        <div className="empty">還沒有收藏的行程。到<Link href="/trips" style={{ color: "var(--green)", textDecoration: "underline" }}>行程分享牆</Link>按 ♡ 收藏喜歡的行程。</div>
      ) : (
        <div className="ig-feed">
          {saved.map((t) => <TripCard key={t.id} trip={t} />)}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
        <SignOutButton />
      </div>
    </main>
  );
}
