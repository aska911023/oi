import TripsExplore from "@/components/trips-explore";
import { getTripsInitial } from "@/lib/trips";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const { trips: initial, total } = await getTripsInitial();

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
