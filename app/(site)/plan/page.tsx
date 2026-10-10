import TripPlanner from "@/components/trip-planner";
import { getPublishedStays } from "@/lib/stays";
import { getPublishedPlaces } from "@/lib/places";
import { getPublishedRentalShops } from "@/lib/rentals";
import { getStations } from "@/lib/stations";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const { load } = await searchParams;
  const [{ stays }, attractions, foods, parkings, rentals, stations] = await Promise.all([
    getPublishedStays(),
    getPublishedPlaces("attraction"),
    getPublishedPlaces("food"),
    getPublishedPlaces("parking"),
    getPublishedRentalShops(),
    getStations(),
  ]);

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  // isCreator / loggedIn 跟著 admin 的檢視身分預覽走(影片欄只給創作者)
  const viewer = await getViewer();
  const isCreator = viewer.role === "creator" || viewer.role === "admin";

  // 住宿改用「房型」清單(民宿名 · 房型名),規劃時可直接選房型
  type RoomRow = { id: string; name: string; stays: { id: string; name: string; region: string; town: string } | { id: string; name: string; region: string; town: string }[] | null };
  const { data: roomRows } = await sb.from("room_types")
    .select("id, name, sort, stays!inner(id, name, region, town, published, visibility, approved)")
    .eq("published", true)
    .eq("stays.published", true)
    .eq("stays.visibility", "published")
    .eq("stays.approved", true)
    .order("sort");
  const rooms = ((roomRows || []) as RoomRow[]).map((r) => {
    const s = Array.isArray(r.stays) ? r.stays[0] : r.stays;
    return { id: r.id, stayId: s?.id || "", name: `${s?.name || "民宿"} · ${r.name}`, region: s?.region || "", town: s?.town || "" };
  }).filter((x) => x.stayId);

  let initial = null;
  let initialOwned = false;
  if (load) {
    const { data } = await sb.from("trips").select("*").eq("id", load).maybeSingle();
    if (data) {
      initial = data;
      initialOwned = !!user && data.owner_id === user.id;
    }
  }

  return (
    <main className="shell plan-wrap">
      <div className="plan-head">
        <h1 className="serif">規劃行程</h1>
        <p>設定天數與人數,把想去的民宿、景點、美食、停車點排進每一天,匯出檔案或列印,和旅伴一起討論。</p>
      </div>
      <TripPlanner
        stays={stays.map((s) => ({ id: s.id, name: s.name, region: s.region, town: s.town }))}
        rooms={rooms}
        attractions={attractions.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        foods={foods.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        parkings={parkings.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        rentals={rentals.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        stations={stations.map((s) => ({ id: s.id, name: (s.kind === "hsr" ? "高鐵 " : "台鐵 ") + s.name, region: s.region, town: "" }))}
        loggedIn={viewer.loggedIn}
        initial={initial}
        initialOwned={initialOwned}
        isCreator={isCreator}
      />
    </main>
  );
}
