import Link from "next/link";
import { Logo } from "@/components/logo";
import SiteHeader from "@/components/site-header";
import Explore from "@/components/explore";
import SiteTheme from "@/components/site-theme";
import { getStaysInitial } from "@/lib/stays";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  // 第一頁(RPC 分頁)+ 總數 + 地區;DB 無資料 → 範例 fallback。
  const { stays, total, usingSamples, regions } = await getStaysInitial();
  const settings = await getSiteSettings();

  return (
    <>
      <SiteTheme s={settings} />
      <SiteHeader />

      <main>
        <Explore stays={stays} total={total} usingSamples={usingSamples} regions={regions} blocks={settings.blocks} searchHint={settings.search_hint} heroLayout={settings.hero_layout} heroSplitRatio={settings.hero_split_ratio} />
      </main>

      <footer className="footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>偶爾出走,找到喜歡的一宿。<br />以地區、風格與預算,探索全台民宿。</p>
          </div>
          <div className="footer-col">
            <h4>探索</h4>
            <Link href="/">全部民宿</Link>
            <Link href="/">熱門地區</Link>
            <Link href="/">精選推薦</Link>
          </div>
          <div className="footer-col">
            <h4>業者</h4>
            <Link href="/login">業者上架</Link>
            <Link href="/login">登入 / 註冊</Link>
          </div>
          <div className="footer-col">
            <h4>關於偶宿</h4>
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私權政策</Link>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>© 2026 偶宿數位科技有限公司 · 台灣民宿搜尋平台</span>
          <span className="tagline">一段旅行,一處喜歡的日常。</span>
        </div>
      </footer>
    </>
  );
}
