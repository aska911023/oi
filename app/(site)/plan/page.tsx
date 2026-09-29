import TripPlanner from "@/components/trip-planner";
import { getPublishedStays } from "@/lib/stays";
import { getPublishedPlaces } from "@/lib/places";
import { getPublishedRentalShops } from "@/lib/rentals";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const { load } = await searchParams;
  const [{ stays }, attractions, foods, parkings, rentals] = await Promise.all([
    getPublishedStays(),
    getPublishedPlaces("attraction"),
    getPublishedPlaces("food"),
    getPublishedPlaces("parking"),
    getPublishedRentalShops(),
  ]);

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

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
        attractions={attractions.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        foods={foods.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        parkings={parkings.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        rentals={rentals.map((p) => ({ id: p.id, name: p.name, region: p.region, town: p.town }))}
        loggedIn={!!user}
        initial={initial}
        initialOwned={initialOwned}
      />
    </main>
  );
}
