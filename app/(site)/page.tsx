import Link from "next/link";
import Explore from "@/components/explore";
import { getRoomsInitial } from "@/lib/rooms";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { rooms, total, regions, categories } = await getRoomsInitial();
  const settings = await getSiteSettings();

  return (
    <main>
      <Explore rooms={rooms} total={total} regions={regions} categories={categories} blocks={settings.blocks} searchHint={settings.search_hint} heroLayout={settings.hero_layout} heroSplitRatio={settings.hero_split_ratio} />
      {regions.length > 0 && (
        <section className="shell" style={{ paddingBottom: 54 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>探索各地區民宿</h2>
          <div className="region-links">
            {regions.map((r) => <Link key={r} href={`/stays/${encodeURIComponent(r)}`} className="region-link">{r}民宿</Link>)}
          </div>
        </section>
      )}
    </main>
  );
}
