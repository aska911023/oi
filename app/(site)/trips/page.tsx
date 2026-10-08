import TripsExplore from "@/components/trips-explore";
import { getTripsInitial } from "@/lib/trips";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const { trips: initial, total } = await getTripsInitial();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  let myName = "";
  let myAvatar: string | null = null;
  if (user) {
    const { data } = await sb.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
    myName = data?.display_name || user.email?.split("@")[0] || "我";
    myAvatar = data?.avatar_url || null;
  }

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head">
        <h1 className="serif">行程分享牆</h1>
        <p>看看大家怎麼玩——依天數、預算、人數與交通方式篩選,找到適合你的行程當範本。</p>
      </div>
      <TripsExplore initialTrips={initial} initialTotal={total} loggedIn={!!user} myName={myName} myAvatar={myAvatar} viewerId={user?.id ?? null} />
    </main>
  );
}
