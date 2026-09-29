import Explore from "@/components/explore";
import { getStaysInitial } from "@/lib/stays";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  // 第一頁(RPC 分頁)+ 總數 + 地區;DB 無資料 → 範例 fallback。
  const { stays, total, usingSamples, regions } = await getStaysInitial();
  const settings = await getSiteSettings();

  return (
    <main>
      <Explore stays={stays} total={total} usingSamples={usingSamples} regions={regions} blocks={settings.blocks} searchHint={settings.search_hint} heroLayout={settings.hero_layout} heroSplitRatio={settings.hero_split_ratio} />
    </main>
  );
}
