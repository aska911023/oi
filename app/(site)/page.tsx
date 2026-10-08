import type { Metadata } from "next";
import Link from "next/link";
import Explore from "@/components/explore";
import { getRoomsInitial } from "@/lib/rooms";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

// 首頁分享卡(og:title / og:description)吃後台「首頁設定」可編輯的欄位
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = s.share_title || "偶宿 O! · 台灣民宿搜尋";
  const description = s.share_desc || "彙整全台民宿,包棟/親子/海景一次搜尋,看房型價格與周邊景點。";
  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, url: "https://www.oi-stay.com", type: "website", siteName: "偶宿 O!", locale: "zh_TW" },
    twitter: { card: "summary_large_image", title, description },
  };
}

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
