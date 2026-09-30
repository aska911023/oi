import Explore from "@/components/explore";
import { getRoomsInitial } from "@/lib/rooms";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { rooms, total } = await getRoomsInitial();
  const settings = await getSiteSettings();

  return (
    <main>
      <Explore rooms={rooms} total={total} blocks={settings.blocks} searchHint={settings.search_hint} heroLayout={settings.hero_layout} heroSplitRatio={settings.hero_split_ratio} />
    </main>
  );
}
