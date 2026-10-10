import TripsExplore from "@/components/trips-explore";
import { getTripsInitial } from "@/lib/trips";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const { trips: initial, total } = await getTripsInitial();
  // 用「有效身分」(會跟著 admin 的檢視身分預覽走):預覽成一般會員時 isCreator=false,就不顯示分享影音
  const viewer = await getViewer();
  const myName = viewer.name || "我";
  const isCreator = viewer.role === "creator" || viewer.role === "admin";

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head">
        <h1 className="serif">行程分享牆</h1>
        <p>看看大家怎麼玩——依天數、預算、人數與交通方式篩選,找到適合你的行程當範本。</p>
      </div>
      <TripsExplore initialTrips={initial} initialTotal={total} loggedIn={viewer.loggedIn} myName={myName} myAvatar={viewer.avatarUrl} viewerId={viewer.userId} isCreator={isCreator} />
    </main>
  );
}
