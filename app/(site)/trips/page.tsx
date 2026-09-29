import TripsExplore from "@/components/trips-explore";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const sb = await createClient();
  const { data } = await sb.rpc("search_trips", { lim: 24, off: 0 });
  const initial = (data?.rows || []) as Trip[];
  const total: number = data?.total ?? 0;

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head">
        <h1 className="serif">行程分享牆</h1>
        <p>看看大家怎麼玩——依天數、預算、人數與交通方式篩選,找到適合你的行程當範本。</p>
      </div>
      <TripsExplore initialTrips={initial} initialTotal={total} />
    </main>
  );
}
