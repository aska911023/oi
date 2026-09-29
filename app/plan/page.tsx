import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteTheme from "@/components/site-theme";
import TripPlanner from "@/components/trip-planner";
import { getSiteSettings } from "@/lib/site-settings";
import { getPublishedStays } from "@/lib/stays";
import { getPublishedPois } from "@/lib/pois";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const settings = await getSiteSettings();
  const [{ stays }, attractions, foods, parkings] = await Promise.all([
    getPublishedStays(),
    getPublishedPois("attraction"),
    getPublishedPois("food"),
    getPublishedPois("parking"),
  ]);

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <>
      <SiteTheme s={settings} />
      <SiteHeader />
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
          loggedIn={!!user}
        />
      </main>
      <footer className="footer">
        <div className="shell footer-bottom" style={{ borderTop: "none" }}>
          <span>© 2026 偶宿數位科技有限公司</span>
          <Link href="/" style={{ color: "inherit" }}>回首頁</Link>
        </div>
      </footer>
    </>
  );
}
