import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteTheme from "@/components/site-theme";
import { Logo } from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";
import { POI_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

// 共用外殼:header / 主題 / footer 常駐,導航時只換 children(不再每頁重查登入)
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <>
      <SiteTheme s={settings} />
      <SiteHeader />
      {children}
      <footer className="footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>偶爾出走,找到喜歡的一宿。<br />以地區、風格與預算,探索全台民宿。</p>
          </div>
          <div className="footer-col">
            <h4>探索</h4>
            <Link href="/">全部民宿</Link>
            {POI_KINDS.map((k) => <Link key={k.slug} href={`/places/${k.slug}`}>{k.label}</Link>)}
            <Link href="/rentals">租車</Link>
          </div>
          <div className="footer-col">
            <h4>行程</h4>
            <Link href="/plan">規劃行程</Link>
            <Link href="/trips">行程分享</Link>
          </div>
          <div className="footer-col">
            <h4>業者 / 關於</h4>
            <Link href="/apply">業者上架</Link>
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
